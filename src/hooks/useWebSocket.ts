import { useState, useEffect, useCallback, useRef } from 'react'
import type { ServerMessage } from '@shared/types'

// Use relative WebSocket URL to go through Vite proxy (supports both HTTP and HTTPS)
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws`

// Clean up WebSocket handlers and close connection
function cleanupWebSocket(ws: WebSocket | null): void {
  if (!ws) return
  ws.onopen = null
  ws.onmessage = null
  ws.onclose = null
  ws.onerror = null
  if (ws.readyState !== WebSocket.CLOSED) {
    ws.close()
  }
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Clean up existing WebSocket before creating new one
    cleanupWebSocket(wsRef.current)
    wsRef.current = null

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[claude-rpg] Connected to server')
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage

        switch (message.type) {
          case 'event':
          case 'history':
            // Events dispatched via CustomEvents; no state needed
            break

          // Pane-centric messages
          case 'windows':
            window.dispatchEvent(new CustomEvent('windows_update', { detail: message.payload }))
            break

          case 'pane_update':
            window.dispatchEvent(new CustomEvent('pane_update', { detail: message.payload }))
            break

          case 'pane_removed':
            window.dispatchEvent(new CustomEvent('pane_removed', { detail: message.payload }))
            break

          // Companion messages (for XP/stats)
          case 'companion_update':
            window.dispatchEvent(new CustomEvent('companion_update', { detail: message.payload }))
            break

          case 'companions':
            window.dispatchEvent(new CustomEvent('companions_init', { detail: message.payload }))
            break

          case 'xp_gain':
            window.dispatchEvent(new CustomEvent('xp_gain', { detail: message.payload }))
            break

          case 'terminal_output':
            window.dispatchEvent(new CustomEvent('terminal_output', { detail: message.payload }))
            break

          case 'pane_error':
            window.dispatchEvent(new CustomEvent('pane_error', { detail: message.payload }))
            break

          case 'competitions':
            window.dispatchEvent(new CustomEvent('competitions_update', { detail: message.payload }))
            break
        }
      } catch (e) {
        console.error('[claude-rpg] Error parsing message:', e)
      }
    }

    ws.onclose = () => {
      console.log('[claude-rpg] Disconnected from server')
      setConnected(false)

      // Reconnect after delay
      reconnectTimeoutRef.current = window.setTimeout(connect, 2000)
    }

    ws.onerror = (error) => {
      console.error('[claude-rpg] WebSocket error:', error)
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()

    // Listen for backend switch events to reconnect WebSocket
    const handleBackendSwitch = () => {
      console.log('[claude-rpg] Backend switched, reconnecting WebSocket...')
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = undefined
      }
      cleanupWebSocket(wsRef.current)
      wsRef.current = null
      // Small delay to let the proxy settle
      setTimeout(connect, 500)
    }
    window.addEventListener('backend_switch', handleBackendSwitch)

    return () => {
      window.removeEventListener('backend_switch', handleBackendSwitch)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = undefined
      }
      cleanupWebSocket(wsRef.current)
      wsRef.current = null
    }
  }, [connect])

  return { connected }
}
