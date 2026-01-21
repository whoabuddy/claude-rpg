import { useState, useEffect, useCallback, useRef } from 'react'
import type { ClaudeEvent, ServerMessage } from '@shared/types'

const WS_URL = `ws://${window.location.hostname}:${__SERVER_PORT__}`

declare const __SERVER_PORT__: number

export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<ClaudeEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

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
            setEvents(prev => [...prev.slice(-99), message.payload])
            break

          case 'history':
            setEvents(message.payload)
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
      wsRef.current = null

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

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, events }
}
