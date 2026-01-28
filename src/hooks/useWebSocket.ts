import { useState, useEffect, useCallback, useRef } from 'react'
import type { ServerMessage } from '@shared/types'

// Use relative WebSocket URL to go through Vite proxy (supports both HTTP and HTTPS)
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws`

// Backoff constants
const MIN_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const SLEEP_DETECTION_THRESHOLD = 5000

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
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()
  const lastActivityTimeRef = useRef<number>(Date.now())
  const scheduledReconnectTimeRef = useRef<number>(0)

  // Helper to clear pending reconnect and reset attempt counter
  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    setReconnectAttempt(0)
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Clean up existing WebSocket before creating new one
    cleanupWebSocket(wsRef.current)
    wsRef.current = null

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[claude-rpg] Connected to server')
      setConnected(true)
      setReconnectAttempt(0) // Reset backoff on successful connection
      lastActivityTimeRef.current = Date.now()
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

          // Quest messages
          case 'quest_update':
            window.dispatchEvent(new CustomEvent('quest_update', { detail: message.payload }))
            break

          case 'quests_init':
            window.dispatchEvent(new CustomEvent('quests_init', { detail: message.payload }))
            break

          case 'quest_xp':
            window.dispatchEvent(new CustomEvent('quest_xp', { detail: message.payload }))
            break

          case 'achievement_unlocked':
            window.dispatchEvent(new CustomEvent('achievement_unlocked', { detail: message.payload }))
            break

          case 'workers_init':
            window.dispatchEvent(new CustomEvent('workers_init', { detail: message.payload }))
            break
        }
      } catch (e) {
        console.error('[claude-rpg] Error parsing message:', e)
      }
    }

    ws.onclose = () => {
      console.log('[claude-rpg] Disconnected from server')
      setConnected(false)

      // Calculate exponential backoff delay with jitter
      setReconnectAttempt((attempt) => {
        const nextAttempt = attempt + 1
        const baseDelay = Math.min(MIN_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY)
        const jitter = baseDelay * 0.1 * Math.random() // 10% jitter
        const delay = baseDelay + jitter

        // Track when we scheduled the reconnect and when we last had activity
        lastActivityTimeRef.current = Date.now()
        scheduledReconnectTimeRef.current = delay

        reconnectTimeoutRef.current = window.setTimeout(() => {
          const elapsed = Date.now() - lastActivityTimeRef.current

          // If elapsed time is significantly more than scheduled delay,
          // device likely slept - reset backoff
          if (elapsed > scheduledReconnectTimeRef.current + SLEEP_DETECTION_THRESHOLD) {
            console.log('[claude-rpg] Sleep detected, resetting backoff')
            setReconnectAttempt(0)
          }
          connect()
        }, delay)

        return nextAttempt
      })
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
      clearReconnect()
      cleanupWebSocket(wsRef.current)
      wsRef.current = null
      // Small delay to let the proxy settle
      setTimeout(connect, 500)
    }
    window.addEventListener('backend_switch', handleBackendSwitch)

    // Listen for visibility changes - reconnect immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      ) {
        console.log('[claude-rpg] Tab visible, reconnecting...')
        clearReconnect()
        connect()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('[claude-rpg] Network online, reconnecting...')
      clearReconnect()
      connect()
    }

    const handleOffline = () => {
      console.log('[claude-rpg] Network offline')
      clearReconnect()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('backend_switch', handleBackendSwitch)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearReconnect()
      cleanupWebSocket(wsRef.current)
      wsRef.current = null
    }
  }, [connect, clearReconnect])

  // Force immediate reconnection (for manual retry button)
  const forceReconnect = useCallback(() => {
    console.log('[claude-rpg] Manual reconnect requested')
    clearReconnect()
    cleanupWebSocket(wsRef.current)
    wsRef.current = null
    connect()
  }, [connect, clearReconnect])

  return { connected, reconnectAttempt, forceReconnect }
}
