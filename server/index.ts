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
// Event Processing
// ═══════════════════════════════════════════════════════════════════════════

function handleEvent(event: ClaudeEvent) {
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
