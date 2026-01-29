/**
 * React hook for WebSocket connection management.
 * Initializes WebSocket on mount, cleans up on unmount.
 * Reads connection state from Zustand store.
 */

import { useEffect } from 'react'
import { useStore } from '../store'
import { initWebSocket, forceReconnect } from '../lib/websocket'

/**
 * Hook to manage WebSocket lifecycle and access connection state.
 * Call this once at the app root level.
 */
export function useConnection() {
  const status = useStore((state) => state.status)
  const reconnectAttempt = useStore((state) => state.reconnectAttempt)

  useEffect(() => {
    const cleanup = initWebSocket()
    return cleanup
  }, [])

  return {
    connected: status === 'connected',
    connecting: status === 'connecting',
    disconnected: status === 'disconnected',
    status,
    reconnectAttempt,
    forceReconnect,
  }
}

/**
 * Hook to just read connection status (no lifecycle management).
 * Use this in child components that need connection state.
 */
export function useConnectionStatus() {
  const status = useStore((state) => state.status)
  const reconnectAttempt = useStore((state) => state.reconnectAttempt)

  return {
    connected: status === 'connected',
    connecting: status === 'connecting',
    disconnected: status === 'disconnected',
    status,
    reconnectAttempt,
    forceReconnect,
  }
}
