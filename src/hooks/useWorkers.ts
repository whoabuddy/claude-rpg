import { useEffect } from 'react'
import { useStore } from '../store'
import type { ClaudeSessionInfo } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

/**
 * Hook to access workers from the Zustand store.
 * Workers are Claude sessions with stats and metadata.
 */
export function useWorkers() {
  const workers = useStore((state) => state.workers)
  const setWorkers = useStore((state) => state.setWorkers)

  // Fetch workers on mount (initial load before WebSocket connects)
  useEffect(() => {
    fetch(`${API_URL}/api/workers`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setWorkers(data.data)
        }
      })
      .catch(e => {
        console.error('[claude-rpg] Error fetching workers:', e)
      })
  }, [setWorkers])

  return {
    workers,
    loading: false, // Store is always populated by WebSocket
  }
}

/**
 * Get a single worker by ID.
 */
export function useWorker(id: string): ClaudeSessionInfo | undefined {
  return useStore((state) => state.workers.find(w => w.id === id))
}
