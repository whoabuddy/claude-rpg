/**
 * WebSocket heartbeat with ping and stale connection detection
 */

import type { ServerWebSocket } from 'bun'
import { getConfig } from '../lib/config'
import { getClients, removeClient } from './broadcast'
import { createLogger } from '../lib/logger'
import type { WsData } from './ws'

const log = createLogger('heartbeat')

let heartbeatInterval: Timer | null = null

/**
 * Start heartbeat interval that sends ping frames
 * and removes stale connections (missed 2+ pongs)
 */
export function startHeartbeat(): void {
  const config = getConfig()
  const interval = config.wsHeartbeatInterval

  heartbeatInterval = setInterval(() => {
    const now = Date.now()
    const clients = getClients() as Set<ServerWebSocket<WsData>>
    const staleThreshold = interval * 2 // 60 seconds with default 30s interval

    let pinged = 0
    let removed = 0

    for (const client of clients) {
      const timeSinceLastPong = now - client.data.lastPong

      // Check if connection is stale (missed 2+ pongs)
      if (timeSinceLastPong > staleThreshold) {
        log.warn('Removing stale connection', {
          sessionId: client.data.sessionId,
          timeSinceLastPong,
          threshold: staleThreshold,
        })

        removeClient(client)
        try {
          client.close()
        } catch (error) {
          log.error('Failed to close stale connection', {
            sessionId: client.data.sessionId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        removed++
      } else {
        // Send ping frame to keep connection alive
        try {
          client.ping()
          pinged++
        } catch (error) {
          log.warn('Failed to ping client', {
            sessionId: client.data.sessionId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    log.debug('Heartbeat tick', {
      clients: clients.size,
      pinged,
      removed,
    })
  }, interval)

  log.info('Heartbeat started', { interval })
}

/**
 * Stop heartbeat interval
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
    log.info('Heartbeat stopped')
  }
}
