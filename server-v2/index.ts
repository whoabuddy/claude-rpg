/**
 * Claude RPG Server v2
 *
 * Bun-native server with SQLite storage, domain-driven architecture,
 * and real-time WebSocket updates.
 */

import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getConfig } from './lib/config'
import { logger, createLogger } from './lib/logger'
import { initShutdown, onShutdown } from './lib/shutdown'
import { initDatabase } from './db'
import { eventBus, initEventHandlers } from './events'
import { startPolling, stopPolling } from './tmux'
import { handleRequest, handleCors, isWebSocketUpgrade, wsHandlers, broadcast } from './api'
import { hasClientBuild, serveStatic, serveSpaFallback } from './api/static'
import { startHeartbeat, stopHeartbeat } from './api/heartbeat'
import { getAllCompanions } from './companions'
import { updateFromTerminal } from './sessions/manager'
import { startWatcher as startMoltbookWatcher, stopWatcher as stopMoltbookWatcher } from './moltbook'
import type { WsData } from './api'
import type { PaneDiscoveredEvent, PaneRemovedEvent } from './events/types'

const log = createLogger('main')

async function main() {
  // Initialize shutdown handlers first
  initShutdown()

  const config = getConfig()
  log.info('Starting Claude RPG Server v2', {
    port: config.port,
    dataDir: config.dataDir,
    logLevel: config.logLevel,
  })

  // Initialize database
  const db = initDatabase()
  log.info('Database ready')

  // Initialize avatars directory
  const avatarsDir = join(config.dataDir, 'avatars')
  if (!existsSync(avatarsDir)) {
    mkdirSync(avatarsDir, { recursive: true })
    log.info('Created avatars directory', { path: avatarsDir })
  }

  // Initialize event handlers (persona XP, etc.)
  initEventHandlers()
  log.info('Event handlers ready')

  // Subscribe to events for broadcasts
  eventBus.on('*', async (event) => {
    // Broadcast all events to WebSocket clients
    broadcast({
      type: 'event',
      payload: {
        eventType: event.type,
        paneId: 'paneId' in event ? (event as { paneId: string }).paneId : undefined,
        timestamp: new Date().toISOString(),
      },
    })
  })

  // Track previous terminal content hashes to avoid redundant broadcasts
  const terminalHashes = new Map<string, string>()

  // Simple hash function for terminal content
  function hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }

  // Start tmux poller
  startPolling(async (state) => {
    // Broadcast windows state (client expects TmuxWindow[] in payload)
    broadcast({
      type: 'windows',
      payload: state.windows,
    })

    // Broadcast companions (projects with stats)
    const companions = getAllCompanions()
    broadcast({
      type: 'companions',
      payload: companions,
    })

    // Broadcast terminal content for Claude panes (only when changed)
    // Also update session status based on terminal content
    let terminalBroadcasts = 0
    for (const pane of state.panes) {
      if (pane.process.type === 'claude' && pane.terminalContent) {
        // Update session status from terminal content
        await updateFromTerminal(pane.id, pane.terminalContent)

        const contentHash = hashContent(pane.terminalContent)
        const previousHash = terminalHashes.get(pane.id)

        if (contentHash !== previousHash) {
          // Content changed, broadcast it
          broadcast({
            type: 'terminal_output',
            payload: {
              paneId: pane.id,
              target: pane.id,
              content: pane.terminalContent,
            },
          })
          terminalHashes.set(pane.id, contentHash)
          terminalBroadcasts++
        }
      }
    }

    // Log terminal broadcasts if any occurred
    if (terminalBroadcasts > 0) {
      log.debug('Broadcast terminal updates', { count: terminalBroadcasts })
    }

    // Clean up hashes for panes that no longer exist
    const currentPaneIds = new Set(state.panes.map(p => p.id))
    for (const paneId of terminalHashes.keys()) {
      if (!currentPaneIds.has(paneId)) {
        terminalHashes.delete(paneId)
      }
    }

    // Emit pane events
    // Note: In a full implementation, we'd track previous state
    // and emit discovered/removed events. For now, we just broadcast windows.
  }, config.pollInterval)

  onShutdown('tmux-poller', () => {
    log.info('Stopping tmux poller')
    stopPolling()
  }, 60)

  // Start moltbook watcher for real-time activity feed
  startMoltbookWatcher()
  log.info('Moltbook watcher started')

  onShutdown('moltbook-watcher', () => {
    log.info('Stopping moltbook watcher')
    stopMoltbookWatcher()
  }, 65)

  // Check for client build
  const serveClient = hasClientBuild()
  if (serveClient) {
    log.info('Client build found, serving static files')
  } else {
    log.warn('No client build found - run "bun run build" in project root')
  }

  // Start HTTP/WebSocket server
  const server = Bun.serve<WsData>({
    port: config.port,

    async fetch(req, server) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return handleCors(req)
      }

      // Handle WebSocket upgrade
      if (isWebSocketUpgrade(req)) {
        const success = server.upgrade(req, {
          data: {
            sessionId: '',
            connectedAt: new Date().toISOString(),
          },
        })
        if (success) {
          return undefined as unknown as Response
        }
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      // Try API routes first
      if (pathname.startsWith('/api/') || pathname === '/health' || pathname === '/event') {
        return handleRequest(req)
      }

      // Serve static files in production
      if (serveClient) {
        // Try to serve exact file
        const staticResponse = await serveStatic(pathname)
        if (staticResponse) {
          return staticResponse
        }

        // SPA fallback - serve index.html for client-side routing
        const spaResponse = await serveSpaFallback()
        if (spaResponse) {
          return spaResponse
        }
      }

      // No client build - return API error
      return handleRequest(req)
    },

    websocket: wsHandlers,
  })

  // Register server shutdown
  onShutdown('http-server', () => {
    log.info('Stopping HTTP server')
    server.stop()
  }, 50)

  // Start WebSocket heartbeat
  startHeartbeat()
  log.info('Heartbeat started')

  // Register heartbeat shutdown (after http-server at 50, before tmux-poller at 60)
  onShutdown('heartbeat', () => {
    log.info('Stopping heartbeat')
    stopHeartbeat()
  }, 55)

  log.info('Server ready', {
    url: `http://localhost:${config.port}`,
    health: `http://localhost:${config.port}/health`,
    ws: `ws://localhost:${config.port}`,
  })
}

// Run
main().catch((error) => {
  logger.error('Fatal error', { error: error.message, stack: error.stack })
  process.exit(1)
})
