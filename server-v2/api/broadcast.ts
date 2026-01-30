/**
 * WebSocket broadcast with backpressure handling
 */

import type { ServerWebSocket } from 'bun'
import { createLogger } from '../lib/logger'
import { getPriority, type ServerMessage, type MessagePriority } from './messages'

const log = createLogger('broadcast')

// Thresholds in bytes
const BUFFER_HIGH = 64 * 1024 // 64KB
const BUFFER_LOW = 16 * 1024 // 16KB

// Client tracking
const clients = new Set<ServerWebSocket<unknown>>()
const pausedClients = new Set<ServerWebSocket<unknown>>()

/**
 * Add a client
 */
export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws)
  log.debug('Client connected', { total: clients.size })
}

/**
 * Remove a client
 */
export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws)
  pausedClients.delete(ws)
  log.debug('Client disconnected', { total: clients.size })
}

/**
 * Get client count
 */
export function getClientCount(): number {
  return clients.size
}

/**
 * Get clients Set (for health checks and monitoring)
 */
export function getClients(): Set<ServerWebSocket<unknown>> {
  return clients
}

/**
 * Broadcast a message to all clients
 */
export function broadcast(message: ServerMessage): void {
  if (clients.size === 0) {
    return
  }

  const priority = getPriority(message)

  // Safely stringify message - catch circular references
  let json: string
  try {
    json = JSON.stringify(message)
  } catch (error) {
    log.error('Failed to stringify message', {
      type: message.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return
  }

  let sent = 0
  let skipped = 0
  const failedClients: ServerWebSocket<unknown>[] = []

  for (const client of clients) {
    const shouldSend = shouldSendToClient(client, priority)

    if (shouldSend) {
      try {
        client.send(json)
        sent++
      } catch (error) {
        log.warn('Failed to send to client, removing', {
          error: error instanceof Error ? error.message : String(error),
        })
        failedClients.push(client)
      }
    } else {
      skipped++
    }
  }

  // Remove failed clients after iteration (can't modify Set during iteration)
  for (const client of failedClients) {
    removeClient(client)
    try {
      client.close()
    } catch {
      // Ignore close errors
    }
  }

  if (skipped > 0) {
    log.debug('Message skipped for some clients', {
      type: message.type,
      priority,
      sent,
      skipped,
    })
  }
}

/**
 * Check if a message should be sent to a client
 */
function shouldSendToClient(client: ServerWebSocket<unknown>, priority: MessagePriority): boolean {
  // Skip clients not in OPEN state (1 = OPEN, 0 = CONNECTING, 2 = CLOSING, 3 = CLOSED)
  if (client.readyState !== 1) {
    return false
  }

  const buffered = (client as unknown as { bufferedAmount?: number }).bufferedAmount ?? 0

  // Check if client is backlogged
  if (buffered > BUFFER_HIGH) {
    if (!pausedClients.has(client)) {
      pausedClients.add(client)
      log.debug('Client paused due to backpressure', { buffered })
    }
  } else if (buffered < BUFFER_LOW) {
    if (pausedClients.has(client)) {
      pausedClients.delete(client)
      log.debug('Client resumed', { buffered })
    }
  }

  // High priority always goes through
  if (priority === 'high') {
    return true
  }

  // Check if client is paused
  if (pausedClients.has(client)) {
    // Normal priority: skip when paused
    // Low priority: skip when paused
    return false
  }

  return true
}

/**
 * Send a message to a specific client
 */
export function sendTo(client: ServerWebSocket<unknown>, message: ServerMessage): void {
  try {
    client.send(JSON.stringify(message))
  } catch (error) {
    log.warn('Failed to send to client', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Called when client's buffer drains
 */
export function onDrain(client: ServerWebSocket<unknown>): void {
  if (pausedClients.has(client)) {
    pausedClients.delete(client)
    log.debug('Client buffer drained, resumed')
  }
}
