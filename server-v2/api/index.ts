/**
 * API module - HTTP routes and WebSocket
 */

import { createLogger } from '../lib/logger'
import { matchRoute } from './routes'
import * as handlers from './handlers'
import { isWebSocketUpgrade, wsHandlers, type WsData } from './ws'
import type { ApiResponse } from './types'

const log = createLogger('api')

/**
 * Main HTTP fetch handler
 */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method
  const pathname = url.pathname

  log.debug('Request received', { method, pathname })

  // Match route
  const matched = matchRoute(method, pathname)

  if (!matched) {
    return jsonResponse({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route not found: ${method} ${pathname}` },
    }, 404)
  }

  const { route, params } = matched

  try {
    // Parse body if present
    let body: unknown = undefined
    if (request.body && (method === 'POST' || method === 'PATCH')) {
      // Check Content-Type for binary audio data
      const contentType = request.headers.get('Content-Type') || ''
      if (contentType.startsWith('audio/')) {
        // Read as ArrayBuffer and convert to Buffer for audio endpoints
        const arrayBuffer = await request.arrayBuffer()
        body = Buffer.from(arrayBuffer)
      } else {
        // Parse as JSON for all other endpoints
        try {
          body = await request.json()
        } catch {
          body = {}
        }
      }
    }

    // Get handler
    const handler = (handlers as Record<string, Function>)[route.handler]
    if (!handler) {
      log.error('Handler not found', { handler: route.handler })
      return jsonResponse({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Handler not found' },
      }, 500)
    }

    // Call handler with appropriate args
    let result: ApiResponse<unknown>

    if (Object.keys(params).length === 0 && !body) {
      // No params, no body (e.g., GET /health)
      result = await handler()
    } else if (Object.keys(params).length === 0 && body) {
      // Body only (e.g., POST /event)
      result = await handler(body)
    } else if (body) {
      // Params and body (e.g., POST /api/panes/:id/prompt)
      result = await handler(params, body)
    } else if (route.handler.includes('xp') || route.handler === 'listNotes') {
      // XP handlers and listNotes need query params
      result = await handler(url.searchParams)
    } else {
      // Params only (e.g., GET /api/personas/:id)
      result = await handler(params)
    }

    const status = result.success ? 200 : (result.error?.code === 'NOT_FOUND' ? 404 : 400)
    return jsonResponse(result, status)
  } catch (error) {
    log.error('Handler error', {
      handler: route.handler,
      error: error instanceof Error ? error.message : String(error),
    })

    return jsonResponse({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    }, 500)
  }
}

/**
 * Create JSON response
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

/**
 * Handle CORS preflight
 */
export function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// Re-export for use in main server
export { isWebSocketUpgrade, wsHandlers, type WsData }
export { broadcast, getClientCount } from './broadcast'
export * from './types'
export * from './messages'
