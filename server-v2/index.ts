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

  // TODO: Initialize modules in Phase 2+
  // - Event bus
  // - Personas service
  // - Projects service
  // - XP service
  // - Quests service
  // - Sessions manager
  // - Tmux poller

  // Start HTTP/WebSocket server
  const server = Bun.serve({
    port: config.port,

    fetch(req) {
      const url = new URL(req.url)

      // Health check
      if (url.pathname === '/health') {
        return Response.json({
          success: true,
          data: {
            status: 'healthy',
            version: '2.0.0',
            uptime: process.uptime(),
          },
        })
      }

      // TODO: Add routes in Phase 6
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      )
    },

    websocket: {
      open(ws) {
        log.debug('WebSocket connected')
        ws.send(JSON.stringify({ type: 'connected', version: '2.0.0' }))
      },
      message(ws, message) {
        log.debug('WebSocket message received', { message: String(message) })
      },
      close(ws) {
        log.debug('WebSocket disconnected')
      },
    },
  })

  // Register server shutdown
  onShutdown('http-server', () => {
    log.info('Stopping HTTP server')
    server.stop()
  }, 50)

  log.info('Server ready', {
    url: `http://localhost:${config.port}`,
    health: `http://localhost:${config.port}/health`,
  })
}

// Run
main().catch((error) => {
  logger.error('Fatal error', { error: error.message, stack: error.stack })
  process.exit(1)
})
