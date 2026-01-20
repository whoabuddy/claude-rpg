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
import { findOrCreateCompanion, saveCompanions, loadCompanions } from './companions.js'

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

interface RawHookEvent {
  hook_event_name?: string
  hookType?: string
  session_id?: string
  sessionId?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_use_id?: string
  tool_response?: unknown
  cwd?: string
  timestamp?: number
  tmuxTarget?: string
  prompt?: string
  message?: string
  [key: string]: unknown
}

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

function handleEvent(rawEvent: RawHookEvent) {
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
    // Track tmux target for terminal capture
    if (event.tmuxTarget) {
      companionTmuxTargets.set(companion.id, event.tmuxTarget)
    }

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

// ═══════════════════════════════════════════════════════════════════════════
// Terminal Capture
// ═══════════════════════════════════════════════════════════════════════════

// Track tmux targets per companion
const companionTmuxTargets = new Map<string, string>()
const lastTerminalContent = new Map<string, string>()

async function captureTerminal(companionId: string, tmuxTarget: string): Promise<string | null> {
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
  for (const [companionId, tmuxTarget] of companionTmuxTargets) {
    const content = await captureTerminal(companionId, tmuxTarget)
    if (content === null) continue

    // Only broadcast if content changed
    if (lastTerminalContent.get(companionId) === content) continue
    lastTerminalContent.set(companionId, content)

    const output: TerminalOutput = {
      companionId,
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

  // Send prompt to companion
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

        // Find tmux target from recent events for this companion
        const recentEvent = events
          .filter(e => e.cwd === companion.repo.path && e.tmuxTarget)
          .pop()

        if (!recentEvent?.tmuxTarget) {
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
        await execAsync(`tmux paste-buffer -t ${recentEvent.tmuxTarget}`)
        await new Promise(r => setTimeout(r, 100))
        await execAsync(`tmux send-keys -t ${recentEvent.tmuxTarget} Enter`)

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

server.listen(PORT, () => {
  console.log(`[claude-rpg] Server running on port ${PORT}`)
  console.log(`[claude-rpg] Data directory: ${DATA_DIR}`)
  console.log(`[claude-rpg] ${companions.length} companions loaded`)
})
