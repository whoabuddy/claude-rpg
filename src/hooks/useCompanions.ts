import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { fetchInitialData } from '../lib/api'
import type { Companion } from '@shared/types'

/**
 * Hook to access companions from the Zustand store.
 * Fetches initial data on mount, WebSocket updates flow through store.
 */
export function useCompanions() {
  const companions = useStore((state) => state.companions)
  const setCompanions = useStore((state) => state.setCompanions)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fetch companions on mount (initial load before WebSocket connects)
  useEffect(() => {
    fetchInitialData<Companion[]>('companions', (data) => {
      setCompanions(data)
      // Select first companion if none selected
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id)
      }
    })
  }, [setCompanions])

  return { companions, selectedId, setSelectedId }
}

/**
 * Get a single companion by ID from the store.
 */
export function useCompanion(id: string): Companion | undefined {
  return useStore((state) => state.companions.find(c => c.id === id))
}

/**
 * Get companion for a specific repo path.
 */
export function useCompanionByRepoPath(repoPath: string | undefined): Companion | undefined {
  return useStore((state) => {
    if (!repoPath) return undefined
    return state.companions.find(c => c.repo.path === repoPath)
  })
}
