import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { watch } from 'chokidar'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'
import { DEFAULTS, expandPath } from '../shared/defaults.js'
import type {
  ClaudeEvent,
  Companion,
  ServerMessage,
  ClientMessage,
  ApiResponse,
  TerminalOutput,
} from '../shared/types.js'
import { processEvent, detectCommandXP } from './xp.js'
import { findOrCreateCompanion, saveCompanions, loadCompanions, createSession, fetchBitcoinFace } from './companions.js'
import type { Session, PendingQuestion, PreToolUseEvent } from '../shared/types.js'

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.CLAUDE_RPG_PORT || String(DEFAULTS.SERVER_PORT))
const DATA_DIR = expandPath(process.env.CLAUDE_RPG_DATA_DIR || DEFAULTS.DATA_DIR)
const EVENTS_FILE = join(DATA_DIR, DEFAULTS.EVENTS_FILE)

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let companions: Companion[] = loadCompanions(DATA_DIR)
const events: ClaudeEvent[] = []
const clients = new Set<WebSocket>()
const seenEventIds = new Set<string>()

// Idle timeout tracking (companionId:sessionId -> timeout)
const sessionIdleTimeouts = new Map<string, NodeJS.Timeout>()
const IDLE_TIMEOUT_MS = 30000 // 30 seconds
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const SESSION_MAX_INACTIVE_MS = 30 * 60 * 1000 // 30 minutes

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Broadcasting
// ═══════════════════════════════════════════════════════════════════════════

function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Normalization (Claude Code hooks → internal format)
// ═══════════════════════════════════════════════════════════════════════════

// Events can come from Claude Code hooks (snake_case) or already-normalized format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawHookEvent = Record<string, any>

function normalizeEvent(raw: RawHookEvent): ClaudeEvent {
  // Map hook event name to internal type
  const hookName = raw.hook_event_name || raw.hookType || ''
  const typeMap: Record<string, ClaudeEvent['type']> = {
    PreToolUse: 'pre_tool_use',
    PostToolUse: 'post_tool_use',
    Stop: 'stop',
    UserPromptSubmit: 'user_prompt_submit',
    Notification: 'notification',
    SessionStart: 'session_start',
    SessionEnd: 'session_end',
  }

  const type = typeMap[hookName] || 'pre_tool_use'
  const sessionId = raw.session_id || raw.sessionId || ''
  const cwd = raw.cwd || ''
  const timestamp = raw.timestamp || Date.now()
  const tmuxTarget = raw.tmuxTarget || undefined

  const base = { type, sessionId, cwd, timestamp, tmuxTarget }

  if (type === 'pre_tool_use') {
    return {
      ...base,
      type: 'pre_tool_use',
      tool: raw.tool_name || '',
      toolUseId: raw.tool_use_id || '',
      toolInput: raw.tool_input,
    }
  }

  if (type === 'post_tool_use') {
    // Determine success from tool_response
    const response = raw.tool_response as Record<string, unknown> | undefined
    const success = response ? !response.error : true

    return {
      ...base,
      type: 'post_tool_use',
      tool: raw.tool_name || '',
      toolUseId: raw.tool_use_id || '',
      success,
      toolResponse: raw.tool_response,
      toolInput: raw.tool_input, // Include for command detection
    } as ClaudeEvent
  }

  if (type === 'user_prompt_submit') {
    return {
      ...base,
      type: 'user_prompt_submit',
      prompt: raw.prompt || '',
    }
  }

  if (type === 'notification') {
    return {
      ...base,
      type: 'notification',
      message: raw.message || '',
    }
  }

  if (type === 'stop') {
    return {
      ...base,
      type: 'stop',
    }
  }

  return base as ClaudeEvent
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Processing
// ═══════════════════════════════════════════════════════════════════════════

async function handleEvent(rawEvent: RawHookEvent) {
  // Normalize the event from Claude Code hook format to internal format
  const event = normalizeEvent(rawEvent)
  // Dedupe
  const eventId = event.id || `${event.sessionId}-${event.timestamp}-${event.type}`
  if (seenEventIds.has(eventId)) return
  seenEventIds.add(eventId)

  // Keep seenEventIds bounded
  if (seenEventIds.size > DEFAULTS.MAX_EVENTS * 2) {
    const arr = Array.from(seenEventIds)
    arr.slice(0, DEFAULTS.MAX_EVENTS).forEach(id => seenEventIds.delete(id))
  }

  // Find or create companion from CWD
  const companion = findOrCreateCompanion(companions, event.cwd)
  if (companion) {
    // Find or create session within companion
    let session = companion.state.sessions.find(s => s.id === event.sessionId)
    if (!session && event.sessionId) {
      session = createSession(event.sessionId, event.tmuxTarget)
      companion.state.sessions.push(session)
      console.log(`[claude-rpg] New session "${session.name}" (${event.sessionId.slice(0, 8)}...) for ${companion.repo.name}`)

      // Fetch Bitcoin face in background
      fetchBitcoinFace(event.sessionId).then(svg => {
        if (svg && session) {
          session.avatarSvg = svg
          saveCompanions(DATA_DIR, companions)
          broadcast({ type: 'companion_update', payload: companion })
        }
      })
    }

    if (session) {
      // Update session state
      session.lastActivity = event.timestamp
      if (event.tmuxTarget) {
        session.tmuxTarget = event.tmuxTarget
      }

      // Update session status based on event type
      if (event.type === 'pre_tool_use') {
        const preEvent = event as PreToolUseEvent

        // Cancel any pending idle timeout - session is actively working
        const timeoutKey = `${companion.id}:${session.id}`
        const existingTimeout = sessionIdleTimeouts.get(timeoutKey)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
          sessionIdleTimeouts.delete(timeoutKey)
        }

        session.status = 'working'
        session.lastError = undefined // Clear any previous error
        session.currentTool = preEvent.tool
        if (preEvent.toolInput) {
          const filePath = (preEvent.toolInput.file_path || preEvent.toolInput.path) as string | undefined
          session.currentFile = filePath

          // Track recent files for context (keep last 5 unique)
          if (filePath && ['Read', 'Edit', 'Write'].includes(preEvent.tool)) {
            const fileName = filePath.split('/').pop() || filePath
            if (!session.recentFiles) session.recentFiles = []
            // Add to front, remove duplicates, keep 5
            session.recentFiles = [fileName, ...session.recentFiles.filter(f => f !== fileName)].slice(0, 5)
          }
        }

        // Detect AskUserQuestion - set waiting status
        if (preEvent.tool === 'AskUserQuestion' && preEvent.toolInput) {
          session.status = 'waiting'
          const input = preEvent.toolInput as Record<string, unknown>
          const questions = input.questions as Array<{
            question: string
            options: Array<{ label: string; description?: string }>
            multiSelect?: boolean
          }> | undefined

          if (questions && questions.length > 0) {
            const q = questions[0] // Take first question for now
            session.pendingQuestion = {
              question: q.question,
              options: q.options || [],
              multiSelect: q.multiSelect || false,
              toolUseId: preEvent.toolUseId,
              timestamp: event.timestamp,
            }
          }
        }
      } else if (event.type === 'post_tool_use') {
        const postEvent = event as import('../shared/types.js').PostToolUseEvent
        session.currentTool = undefined
        session.currentFile = undefined

        // Detect errors from tool response
        if (!postEvent.success) {
          session.status = 'error'
          session.lastError = {
            tool: postEvent.tool,
            message: typeof postEvent.toolResponse === 'object' && postEvent.toolResponse !== null
              ? (postEvent.toolResponse as Record<string, unknown>).error as string
              : undefined,
            timestamp: event.timestamp,
          }
          console.log(`[claude-rpg] Session "${session.name}" error in ${postEvent.tool}`)
        } else if (session.pendingQuestion) {
          // Clear pending question if AskUserQuestion completed
          session.pendingQuestion = undefined
          session.status = 'working'
        } else if (session.status !== 'waiting') {
          // Keep working status, but schedule idle timeout
          session.lastError = undefined
        }

        // Schedule idle timeout after any tool completion
        if (session.status === 'working') {
          scheduleIdleTimeout(companion, session)
        }
      } else if (event.type === 'stop') {
        session.status = 'idle'
        session.currentTool = undefined
        session.currentFile = undefined
        session.pendingQuestion = undefined
      } else if (event.type === 'user_prompt_submit') {
        session.status = 'working'
        session.pendingQuestion = undefined
        // Track last prompt for context
        const promptEvent = event as import('../shared/types.js').UserPromptSubmitEvent
        if (promptEvent.prompt) {
          // Truncate for display, keep first 100 chars
          session.lastPrompt = promptEvent.prompt.length > 100
            ? promptEvent.prompt.slice(0, 100) + '...'
            : promptEvent.prompt
        }
      }
    }

    // Update companion aggregate status
    updateCompanionStatus(companion)

    // Process event for XP and state updates
    const xpGain = processEvent(companion, event)

    // Save companions if changed
    saveCompanions(DATA_DIR, companions)

    // Broadcast companion update
    broadcast({ type: 'companion_update', payload: companion })

    // Broadcast XP gain if any
    if (xpGain) {
      broadcast({ type: 'xp_gain', payload: xpGain })
    }
  }

  // Store event
  events.push(event)
  if (events.length > DEFAULTS.MAX_EVENTS) {
    events.shift()
  }

  // Broadcast event
  broadcast({ type: 'event', payload: event })
}

// Schedule idle timeout for a session
function scheduleIdleTimeout(companion: Companion, session: Session) {
  const key = `${companion.id}:${session.id}`

  // Clear existing timeout
  const existing = sessionIdleTimeouts.get(key)
  if (existing) clearTimeout(existing)

  // Schedule new timeout
  const timeout = setTimeout(() => {
    // Only transition to idle if currently working (not waiting/error)
    if (session.status === 'working') {
      session.status = 'idle'
      session.currentTool = undefined
      session.currentFile = undefined
      updateCompanionStatus(companion)
      saveCompanions(DATA_DIR, companions)
      broadcast({ type: 'companion_update', payload: companion })
      console.log(`[claude-rpg] Session "${session.name}" idle timeout`)
    }
    sessionIdleTimeouts.delete(key)
  }, IDLE_TIMEOUT_MS)

  sessionIdleTimeouts.set(key, timeout)
}

// Check if a tmux pane exists
async function tmuxPaneExists(target: string): Promise<boolean> {
  if (!target) return false
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    await execAsync(`tmux has-session -t "${target.split('.')[0]}" 2>/dev/null`)
    return true
  } catch {
    return false
  }
}

// Clean up stale sessions and fix stuck "working" status
async function cleanupStaleSessions() {
  const now = Date.now()
  const staleActivityCutoff = now - SESSION_MAX_INACTIVE_MS // 2 hours
  const stuckWorkingCutoff = now - 5 * 60 * 1000 // 5 minutes without activity = stuck
  let changed = false

  for (const companion of companions) {
    const before = companion.state.sessions.length
    const validSessions: Session[] = []

    for (const session of companion.state.sessions) {
      // Check if tmux target still exists
      const paneExists = await tmuxPaneExists(session.tmuxTarget || '')

      if (!paneExists && session.tmuxTarget) {
        // Pane doesn't exist - session is definitely gone
        console.log(`[claude-rpg] Session "${session.name}" removed (tmux pane gone)`)
        changed = true
        continue
      }

      // Transition stuck "working" sessions to idle
      if (session.status === 'working' && session.lastActivity < stuckWorkingCutoff) {
        session.status = 'idle'
        session.currentTool = undefined
        session.currentFile = undefined
        console.log(`[claude-rpg] Session "${session.name}" stuck working → idle`)
        changed = true
      }

      // Keep session if: recent activity OR waiting for input
      if (session.lastActivity > staleActivityCutoff || session.status === 'waiting') {
        validSessions.push(session)
      } else {
        console.log(`[claude-rpg] Session "${session.name}" removed (stale)`)
        changed = true
      }
    }

    companion.state.sessions = validSessions

    if (changed) {
      updateCompanionStatus(companion)
      broadcast({ type: 'companion_update', payload: companion })
    }
  }

  if (changed) saveCompanions(DATA_DIR, companions)
}

// Update companion's aggregate status from sessions
function updateCompanionStatus(companion: Companion) {
  const sessions = companion.state.sessions
  if (sessions.length === 0) {
    companion.state.status = 'idle'
    return
  }

  // Priority: waiting > working > idle
  if (sessions.some(s => s.status === 'waiting')) {
    companion.state.status = 'waiting'
  } else if (sessions.some(s => s.status === 'working')) {
    companion.state.status = 'working'
  } else if (sessions.some(s => s.status === 'error')) {
    companion.state.status = 'attention'
  } else {
    companion.state.status = 'idle'
  }

  companion.state.lastActivity = Math.max(...sessions.map(s => s.lastActivity))
}

// ═══════════════════════════════════════════════════════════════════════════
// Terminal Capture
// ═══════════════════════════════════════════════════════════════════════════

const lastTerminalContent = new Map<string, string>()

async function captureTerminal(tmuxTarget: string): Promise<string | null> {
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // Capture last 30 lines of the tmux pane
    const { stdout } = await execAsync(
      `tmux capture-pane -p -t "${tmuxTarget}" -S -30 2>/dev/null || echo ""`,
      { timeout: 1000 }
    )
    return stdout.trim()
  } catch (e) {
    return null
  }
}

async function broadcastTerminalUpdates() {
  // Build map of tmux target -> most recent ACTIVE session (directly from companions)
  // Only working/waiting sessions should receive terminal output
  const targetToLatestSession = new Map<string, { sessionId: string; companionId: string; lastActivity: number }>()

  for (const companion of companions) {
    for (const session of companion.state.sessions) {
      if (!session.tmuxTarget) continue
      // Only broadcast to active sessions (working or waiting for input)
      if (session.status !== 'working' && session.status !== 'waiting') continue

      const existing = targetToLatestSession.get(session.tmuxTarget)
      if (!existing || session.lastActivity > existing.lastActivity) {
        targetToLatestSession.set(session.tmuxTarget, {
          sessionId: session.id,
          companionId: companion.id,
          lastActivity: session.lastActivity,
        })
      }
    }
  }

  // Only broadcast to the most recent session for each tmux target
  for (const [tmuxTarget, { sessionId, companionId }] of targetToLatestSession) {
    const content = await captureTerminal(tmuxTarget)
    if (content === null) continue

    // Only broadcast if content changed
    if (lastTerminalContent.get(tmuxTarget) === content) continue
    lastTerminalContent.set(tmuxTarget, content)

    const output: TerminalOutput = {
      companionId,
      sessionId,
      tmuxTarget,
      content,
      timestamp: Date.now(),
    }

    broadcast({ type: 'terminal_output', payload: output })
  }
}

// Capture terminal output every 500ms
setInterval(broadcastTerminalUpdates, 500)

// ═══════════════════════════════════════════════════════════════════════════
// File Watching
// ═══════════════════════════════════════════════════════════════════════════

let lastFileSize = 0

function loadEventsFromFile() {
  if (!existsSync(EVENTS_FILE)) return

  const content = readFileSync(EVENTS_FILE, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  console.log(`[claude-rpg] Loaded ${lines.length} events from file`)

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as ClaudeEvent
      handleEvent(event)
    } catch (e) {
      // Skip malformed lines
    }
  }

  lastFileSize = content.length
}

function watchEventsFile() {
  if (!existsSync(EVENTS_FILE)) {
    // Create empty file so watcher can start
    writeFileSync(EVENTS_FILE, '')
  }

  const watcher = watch(EVENTS_FILE, { persistent: true })

  watcher.on('change', () => {
    const content = readFileSync(EVENTS_FILE, 'utf-8')
    if (content.length <= lastFileSize) return

    const newContent = content.slice(lastFileSize)
    lastFileSize = content.length

    const lines = newContent.trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ClaudeEvent
        handleEvent(event)
      } catch (e) {
        // Skip malformed lines
      }
    }
  })

  console.log(`[claude-rpg] Watching ${EVENTS_FILE}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP Server
// ═══════════════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, companions: companions.length }))
    return
  }

  // Event ingestion (from hook)
  if (url.pathname === '/event' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const event = JSON.parse(body) as ClaudeEvent
        handleEvent(event)

        // Also persist to file
        appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n')

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  // List companions
  if (url.pathname === '/api/companions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: companions }))
    return
  }

  // Send prompt to specific session
  const sessionPromptMatch = url.pathname.match(/^\/api\/companions\/([^/]+)\/sessions\/([^/]+)\/prompt$/)
  if (sessionPromptMatch && req.method === 'POST') {
    const [, companionId, sessionId] = sessionPromptMatch
    const companion = companions.find(c => c.id === companionId)

    if (!companion) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Companion not found' }))
      return
    }

    const session = companion.state.sessions.find(s => s.id === sessionId)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Session not found' }))
      return
    }

    if (!session.tmuxTarget) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'No tmux target for session' }))
      return
    }

    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body)

        // Send to tmux via load-buffer/paste-buffer
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)

        const tempFile = `/tmp/claude-rpg-prompt-${Date.now()}.txt`
        writeFileSync(tempFile, prompt)

        await execAsync(`tmux load-buffer ${tempFile}`)
        await execAsync(`tmux paste-buffer -t ${session.tmuxTarget}`)
        await new Promise(r => setTimeout(r, 100))
        await execAsync(`tmux send-keys -t ${session.tmuxTarget} Enter`)

        // Clean up temp file
        const { unlink } = await import('fs/promises')
        await unlink(tempFile).catch(() => {})

        // Clear pending question after answering
        if (session.pendingQuestion) {
          session.pendingQuestion = undefined
          session.status = 'working'
          saveCompanions(DATA_DIR, companions)
          broadcast({ type: 'companion_update', payload: companion })
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }

  // Send prompt to companion (uses most recent session)
  const promptMatch = url.pathname.match(/^\/api\/companions\/([^/]+)\/prompt$/)
  if (promptMatch && req.method === 'POST') {
    const companionId = promptMatch[1]
    const companion = companions.find(c => c.id === companionId)

    if (!companion) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Companion not found' }))
      return
    }

    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body)

        // Find tmux target from sessions (prefer most recent active)
        const session = companion.state.sessions
          .filter(s => s.tmuxTarget)
          .sort((a, b) => b.lastActivity - a.lastActivity)[0]

        if (!session?.tmuxTarget) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'No tmux target found for companion' }))
          return
        }

        // Send to tmux via load-buffer/paste-buffer
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)

        const tempFile = `/tmp/claude-rpg-prompt-${Date.now()}.txt`
        writeFileSync(tempFile, prompt)

        await execAsync(`tmux load-buffer ${tempFile}`)
        await execAsync(`tmux paste-buffer -t ${session.tmuxTarget}`)
        await new Promise(r => setTimeout(r, 100))
        await execAsync(`tmux send-keys -t ${session.tmuxTarget} Enter`)

        // Clean up temp file
        const { unlink } = await import('fs/promises')
        await unlink(tempFile).catch(() => {})

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Not found' }))
})

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Server
// ═══════════════════════════════════════════════════════════════════════════

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log(`[claude-rpg] Client connected (${clients.size} total)`)

  // Send initial state
  ws.send(JSON.stringify({ type: 'connected' } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'companions', payload: companions } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'history', payload: events.slice(-100) } satisfies ServerMessage))

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage
      // Handle client messages if needed
    } catch (e) {
      // Ignore malformed messages
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[claude-rpg] Client disconnected (${clients.size} total)`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════════════

loadEventsFromFile()
watchEventsFile()

// Run cleanup immediately to fix sessions loaded from history
cleanupStaleSessions().catch(e => console.error('[claude-rpg] Cleanup error:', e))

// Start session cleanup interval
setInterval(() => {
  cleanupStaleSessions().catch(e => console.error('[claude-rpg] Cleanup error:', e))
}, SESSION_CLEANUP_INTERVAL_MS)
console.log(`[claude-rpg] Session cleanup scheduled every ${SESSION_CLEANUP_INTERVAL_MS / 1000 / 60} minutes`)

server.listen(PORT, () => {
  console.log(`[claude-rpg] Server running on port ${PORT}`)
  console.log(`[claude-rpg] Data directory: ${DATA_DIR}`)
  console.log(`[claude-rpg] ${companions.length} companions loaded`)
})
