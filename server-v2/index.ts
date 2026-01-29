/**
 * Claude RPG Server v2
 *
 * Bun-native server with SQLite storage, domain-driven architecture,
 * and real-time WebSocket updates.
 */

import { getConfig } from './lib/config'
import { logger, createLogger } from './lib/logger'
import { initShutdown, onShutdown } from './lib/shutdown'
import { initDatabase } from './db'
import { eventBus, initEventHandlers } from './events'
import { startPolling, stopPolling } from './tmux'
import { handleRequest, handleCors, isWebSocketUpgrade, wsHandlers, broadcast } from './api'
import { hasClientBuild, serveStatic, serveSpaFallback } from './api/static'
import { getAllCompanions } from './companions'
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

  // Initialize event handlers (persona XP, etc.)
  initEventHandlers()
  log.info('Event handlers ready')

  // Subscribe to events for broadcasts
  eventBus.on('*', async (event) => {
    // Broadcast all events to WebSocket clients
    broadcast({
      type: 'event',
      eventType: event.type,
      paneId: 'paneId' in event ? (event as { paneId: string }).paneId : undefined,
      timestamp: new Date().toISOString(),
    })
  })

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
      companions,
    })

    // Emit pane events
    // Note: In a full implementation, we'd track previous state
    // and emit discovered/removed events. For now, we just broadcast windows.
  }, config.pollInterval)

  onShutdown('tmux-poller', () => {
    log.info('Stopping tmux poller')
    stopPolling()
  }, 60)

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
        return handleCors()
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
