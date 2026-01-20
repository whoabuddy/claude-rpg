import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { watch } from 'chokidar'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { DEFAULTS, expandPath } from '../shared/defaults.js'

const execAsync = promisify(exec)

import type {
  ClaudeEvent,
  Companion,
  ServerMessage,
  TmuxWindow,
  TmuxPane,
  TerminalOutput,
  ClaudeSessionInfo,
  PreToolUseEvent,
} from '../shared/types.js'
import { processEvent } from './xp.js'
import { findOrCreateCompanion, saveCompanions, loadCompanions, fetchBitcoinFace, getSessionName } from './companions.js'
import {
  pollTmuxState,
  updateClaudeSession,
  getClaudeSession,
  removeClaudeSession,
  findPaneByTarget,
  findPaneById,
  getSessionCache,
  setSessionCache,
} from './tmux.js'

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.CLAUDE_RPG_PORT || String(DEFAULTS.SERVER_PORT))
const DATA_DIR = expandPath(process.env.CLAUDE_RPG_DATA_DIR || DEFAULTS.DATA_DIR)
const EVENTS_FILE = join(DATA_DIR, DEFAULTS.EVENTS_FILE)
const PANES_CACHE_FILE = join(DATA_DIR, 'panes-cache.json')

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let companions: Companion[] = loadCompanions(DATA_DIR)
let windows: TmuxWindow[] = []
const events: ClaudeEvent[] = []
const clients = new Set<WebSocket>()
const seenEventIds = new Set<string>()

// Polling intervals
const TMUX_POLL_INTERVAL_MS = 1000 // 1 second
const TERMINAL_ACTIVE_INTERVAL_MS = 500 // 500ms for active panes
const TERMINAL_IDLE_INTERVAL_MS = 2000 // 2s for idle panes

// ═══════════════════════════════════════════════════════════════════════════
// Pane Cache Persistence
// ═══════════════════════════════════════════════════════════════════════════

function loadPanesCache(): void {
  if (!existsSync(PANES_CACHE_FILE)) return

  try {
    const content = readFileSync(PANES_CACHE_FILE, 'utf-8')
    const data = JSON.parse(content)
    if (data.sessions && typeof data.sessions === 'object') {
      const cache = new Map<string, ClaudeSessionInfo>()
      for (const [paneId, session] of Object.entries(data.sessions)) {
        cache.set(paneId, session as ClaudeSessionInfo)
      }
      setSessionCache(cache)
      console.log(`[claude-rpg] Loaded ${cache.size} cached Claude sessions`)
    }
  } catch (e) {
    console.error('[claude-rpg] Error loading panes cache:', e)
  }
}

function savePanesCache(): void {
  try {
    const cache = getSessionCache()
    const sessions: Record<string, ClaudeSessionInfo> = {}
    for (const [paneId, session] of cache) {
      sessions[paneId] = session
    }
    writeFileSync(PANES_CACHE_FILE, JSON.stringify({ sessions }, null, 2))
  } catch (e) {
    console.error('[claude-rpg] Error saving panes cache:', e)
  }
}

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
// Tmux Polling
// ═══════════════════════════════════════════════════════════════════════════

let previousPaneIds = new Set<string>()

async function pollTmux(): Promise<void> {
  const newWindows = await pollTmuxState()

  // Detect removed panes
  const currentPaneIds = new Set<string>()
  for (const window of newWindows) {
    for (const pane of window.panes) {
      currentPaneIds.add(pane.id)
    }
  }

  for (const paneId of previousPaneIds) {
    if (!currentPaneIds.has(paneId)) {
      // Pane was removed
      removeClaudeSession(paneId)
      broadcast({ type: 'pane_removed', payload: { paneId } })
    }
  }

  previousPaneIds = currentPaneIds
  windows = newWindows

  // Broadcast windows update
  broadcast({ type: 'windows', payload: windows })
}

// Start tmux polling
setInterval(pollTmux, TMUX_POLL_INTERVAL_MS)

// ═══════════════════════════════════════════════════════════════════════════
// Event Normalization (Claude Code hooks → internal format)
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawHookEvent = Record<string, any>

function normalizeEvent(raw: RawHookEvent): ClaudeEvent & { paneId?: string } {
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
  const paneId = raw.paneId || undefined

  const base = { type, sessionId, cwd, timestamp, tmuxTarget }

  if (type === 'pre_tool_use') {
    return {
      ...base,
      type: 'pre_tool_use',
      tool: raw.tool_name || '',
      toolUseId: raw.tool_use_id || '',
      toolInput: raw.tool_input,
      paneId,
    }
  }

  if (type === 'post_tool_use') {
    const response = raw.tool_response as Record<string, unknown> | undefined
    const success = response ? !response.error : true

    return {
      ...base,
      type: 'post_tool_use',
      tool: raw.tool_name || '',
      toolUseId: raw.tool_use_id || '',
      success,
      toolResponse: raw.tool_response,
      toolInput: raw.tool_input,
      paneId,
    } as ClaudeEvent & { paneId?: string }
  }

  if (type === 'user_prompt_submit') {
    return {
      ...base,
      type: 'user_prompt_submit',
      prompt: raw.prompt || '',
      paneId,
    }
  }

  if (type === 'notification') {
    return {
      ...base,
      type: 'notification',
      message: raw.message || '',
      paneId,
    }
  }

  if (type === 'stop') {
    return {
      ...base,
      type: 'stop',
      paneId,
    }
  }

  if (type === 'session_start') {
    return {
      ...base,
      type: 'session_start',
      paneId,
    }
  }

  if (type === 'session_end') {
    return {
      ...base,
      type: 'session_end',
      paneId,
    }
  }

  return {
    ...base,
    type: 'pre_tool_use',
    tool: raw.tool_name || 'unknown',
    toolUseId: raw.tool_use_id || '',
    toolInput: raw.tool_input,
    paneId,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Processing
// ═══════════════════════════════════════════════════════════════════════════

async function handleEvent(rawEvent: RawHookEvent) {
  const event = normalizeEvent(rawEvent)
  const eventId = `${event.sessionId}-${event.timestamp}-${event.type}`
  if (seenEventIds.has(eventId)) return
  seenEventIds.add(eventId)

  // Keep seenEventIds bounded
  if (seenEventIds.size > DEFAULTS.MAX_EVENTS * 2) {
    const arr = Array.from(seenEventIds)
    arr.slice(0, DEFAULTS.MAX_EVENTS).forEach(id => seenEventIds.delete(id))
  }

  // Find pane by paneId or tmuxTarget
  let pane: TmuxPane | undefined
  if (event.paneId) {
    pane = findPaneById(windows, event.paneId)
  }
  if (!pane && event.tmuxTarget) {
    pane = findPaneByTarget(windows, event.tmuxTarget)
  }

  // Update Claude session in pane
  if (pane && event.sessionId) {
    let sessionInfo = getClaudeSession(pane.id)

    if (!sessionInfo) {
      // Create new Claude session
      const name = getSessionName(event.sessionId)
      sessionInfo = updateClaudeSession(pane.id, {
        id: event.sessionId,
        name,
        status: 'idle',
      })

      // Fetch Bitcoin face in background
      if (sessionInfo) {
        fetchBitcoinFace(event.sessionId).then(svg => {
          if (svg) {
            updateClaudeSession(pane!.id, { avatarSvg: svg })
            savePanesCache()
            broadcast({ type: 'pane_update', payload: pane! })
          }
        })
      }
    }

    if (sessionInfo) {
      // Update session state based on event type
      if (event.type === 'pre_tool_use') {
        const preEvent = event as PreToolUseEvent
        sessionInfo.status = 'working'
        sessionInfo.lastError = undefined
        sessionInfo.currentTool = preEvent.tool

        if (preEvent.toolInput) {
          const filePath = (preEvent.toolInput.file_path || preEvent.toolInput.path) as string | undefined
          sessionInfo.currentFile = filePath

          // Track recent files
          if (filePath && ['Read', 'Edit', 'Write'].includes(preEvent.tool)) {
            const fileName = filePath.split('/').pop() || filePath
            if (!sessionInfo.recentFiles) sessionInfo.recentFiles = []
            sessionInfo.recentFiles = [fileName, ...sessionInfo.recentFiles.filter(f => f !== fileName)].slice(0, 5)
          }
        }

        // Detect AskUserQuestion
        if (preEvent.tool === 'AskUserQuestion' && preEvent.toolInput) {
          sessionInfo.status = 'waiting'
          const input = preEvent.toolInput as Record<string, unknown>
          const questions = input.questions as Array<{
            question: string
            options: Array<{ label: string; description?: string }>
            multiSelect?: boolean
          }> | undefined

          if (questions && questions.length > 0) {
            const q = questions[0]
            sessionInfo.pendingQuestion = {
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
        sessionInfo.currentTool = undefined
        sessionInfo.currentFile = undefined

        if (!postEvent.success) {
          sessionInfo.status = 'error'
          sessionInfo.lastError = {
            tool: postEvent.tool,
            message: typeof postEvent.toolResponse === 'object' && postEvent.toolResponse !== null
              ? (postEvent.toolResponse as Record<string, unknown>).error as string
              : undefined,
            timestamp: event.timestamp,
          }
        } else if (sessionInfo.pendingQuestion) {
          sessionInfo.pendingQuestion = undefined
          sessionInfo.status = 'working'
        }
      } else if (event.type === 'stop') {
        sessionInfo.status = 'idle'
        sessionInfo.currentTool = undefined
        sessionInfo.currentFile = undefined
        sessionInfo.pendingQuestion = undefined
      } else if (event.type === 'user_prompt_submit') {
        sessionInfo.status = 'working'
        sessionInfo.pendingQuestion = undefined
        const promptEvent = event as import('../shared/types.js').UserPromptSubmitEvent
        if (promptEvent.prompt) {
          sessionInfo.lastPrompt = promptEvent.prompt.length > 100
            ? promptEvent.prompt.slice(0, 100) + '...'
            : promptEvent.prompt
        }
      } else if (event.type === 'session_end') {
        // Session ended - remove from cache
        removeClaudeSession(pane.id)
      }

      updateClaudeSession(pane.id, sessionInfo)
      savePanesCache()
      broadcast({ type: 'pane_update', payload: pane })
    }
  }

  // Process XP for companion (by CWD → repo)
  const companion = findOrCreateCompanion(companions, event.cwd)
  if (companion) {
    const xpGain = processEvent(companion, event)
    saveCompanions(DATA_DIR, companions)
    broadcast({ type: 'companion_update', payload: companion })

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

// ═══════════════════════════════════════════════════════════════════════════
// Terminal Capture
// ═══════════════════════════════════════════════════════════════════════════

const lastTerminalContent = new Map<string, string>()
let lastTerminalCapture = 0

async function captureTerminal(target: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `tmux capture-pane -p -t "${target}" -S -30 2>/dev/null || echo ""`,
      { timeout: 1000 }
    )
    return stdout.trim()
  } catch {
    return null
  }
}

async function broadcastTerminalUpdates() {
  const now = Date.now()
  const timeSinceLast = now - lastTerminalCapture

  for (const window of windows) {
    for (const pane of window.panes) {
      // Determine capture rate based on pane activity
      const isActive = pane.process.type === 'claude' &&
        pane.process.claudeSession?.status === 'working' ||
        pane.process.claudeSession?.status === 'waiting'

      const interval = isActive ? TERMINAL_ACTIVE_INTERVAL_MS : TERMINAL_IDLE_INTERVAL_MS

      // Skip if not enough time has passed for this pane's rate
      if (timeSinceLast < interval) continue

      const content = await captureTerminal(pane.target)
      if (content === null) continue

      // Only broadcast if content changed
      if (lastTerminalContent.get(pane.id) === content) continue
      lastTerminalContent.set(pane.id, content)

      // Update pane with terminal content
      pane.terminalContent = content

      const output: TerminalOutput = {
        paneId: pane.id,
        target: pane.target,
        content,
        timestamp: now,
      }

      broadcast({ type: 'terminal_output', payload: output })
    }
  }

  lastTerminalCapture = now
}

// Capture terminal output every 500ms (rate limiting handled per-pane)
setInterval(broadcastTerminalUpdates, 500)

// ═══════════════════════════════════════════════════════════════════════════
// Tmux Prompt Helper
// ═══════════════════════════════════════════════════════════════════════════

async function sendPromptToTmux(target: string, prompt: string): Promise<void> {
  const tempFile = `/tmp/claude-rpg-prompt-${Date.now()}.txt`
  writeFileSync(tempFile, prompt)

  await execAsync(`tmux load-buffer ${tempFile}`)
  await execAsync(`tmux paste-buffer -t ${target}`)
  await new Promise(r => setTimeout(r, 100))
  await execAsync(`tmux send-keys -t ${target} Enter`)

  await unlink(tempFile).catch(() => {})
}

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
    } catch {
      // Skip malformed lines
    }
  }

  lastFileSize = content.length
}

function watchEventsFile() {
  if (!existsSync(EVENTS_FILE)) {
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
      } catch {
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
    res.end(JSON.stringify({ ok: true, companions: companions.length, windows: windows.length }))
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
        appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  // List windows with panes
  if (url.pathname === '/api/windows' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: windows }))
    return
  }

  // Get single pane
  const paneMatch = url.pathname.match(/^\/api\/panes\/(%\d+)$/)
  if (paneMatch && req.method === 'GET') {
    const paneId = paneMatch[1]
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Pane not found' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: pane }))
    return
  }

  // Send prompt to pane
  const panePromptMatch = url.pathname.match(/^\/api\/panes\/(%\d+)\/prompt$/)
  if (panePromptMatch && req.method === 'POST') {
    const paneId = panePromptMatch[1]
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Pane not found' }))
      return
    }

    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body)
        await sendPromptToTmux(pane.target, prompt)

        // Clear pending question if Claude pane
        if (pane.process.claudeSession?.pendingQuestion) {
          updateClaudeSession(pane.id, {
            pendingQuestion: undefined,
            status: 'working',
          })
          savePanesCache()
          broadcast({ type: 'pane_update', payload: pane })
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

  // List companions (for XP/stats)
  if (url.pathname === '/api/companions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: companions }))
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
  ws.send(JSON.stringify({ type: 'windows', payload: windows } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'companions', payload: companions } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'history', payload: events.slice(-100) } satisfies ServerMessage))

  ws.on('message', (_data) => {
    // Handle client messages if needed
  })

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[claude-rpg] Client disconnected (${clients.size} total)`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════════════

loadPanesCache()
loadEventsFromFile()
watchEventsFile()

// Initial tmux poll
pollTmux().catch(e => console.error('[claude-rpg] Initial poll error:', e))

server.listen(PORT, () => {
  console.log(`[claude-rpg] Server running on port ${PORT}`)
  console.log(`[claude-rpg] Data directory: ${DATA_DIR}`)
  console.log(`[claude-rpg] ${companions.length} companions loaded`)
})
