/**
 * WebSocket handlers for Bun.serve()
 */

import type { ServerWebSocket } from 'bun'
import { createLogger } from '../lib/logger'
import { addClient, removeClient, sendTo, onDrain } from './broadcast'
import type { ConnectedMessage } from './messages'

const log = createLogger('websocket')

export interface WsData {
  sessionId: string
  connectedAt: string
  lastPong: number
}

/**
 * WebSocket handlers for Bun.serve() websocket config
 */
export const wsHandlers = {
  /**
   * Called when a WebSocket connection is opened
   */
  open(ws: ServerWebSocket<WsData>): void {
    const sessionId = crypto.randomUUID()
    const connectedAt = new Date().toISOString()

    ws.data = { sessionId, connectedAt, lastPong: Date.now() }

    addClient(ws)

    // Send connected message
    const message: ConnectedMessage = {
      type: 'connected',
      sessionId,
      timestamp: connectedAt,
    }
    sendTo(ws, message)

    log.info('WebSocket client connected', { sessionId })
  },

  /**
   * Called when a message is received from the client
   */
  message(ws: ServerWebSocket<WsData>, message: string | Buffer): void {
    // Currently we don't expect client messages
    // But we could handle ping/pong or client commands here
    log.debug('Received message from client', {
      sessionId: ws.data.sessionId,
      message: typeof message === 'string' ? message : '(binary)',
    })
  },

  /**
   * Called when the WebSocket connection is closed
   */
  close(ws: ServerWebSocket<WsData>, code: number, reason: string): void {
    removeClient(ws)

    log.info('WebSocket client disconnected', {
      sessionId: ws.data.sessionId,
      code,
      reason,
    })
  },

  /**
   * Called when the send buffer has been drained
   */
  drain(ws: ServerWebSocket<WsData>): void {
    onDrain(ws)
  },

  /**
   * Called when a pong is received from the client
   */
  pong(ws: ServerWebSocket<WsData>, data: Buffer): void {
    ws.data.lastPong = Date.now()
  },
}

/**
 * Check if a request is a WebSocket upgrade request
 */
export function isWebSocketUpgrade(request: Request): boolean {
  const upgrade = request.headers.get('upgrade')
  return upgrade?.toLowerCase() === 'websocket'
}
