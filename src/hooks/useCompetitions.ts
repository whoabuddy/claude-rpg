import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import type { Competition, TimePeriod } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

/**
 * Hook to access competitions from the Zustand store.
 * Fetches initial data on mount, WebSocket updates flow through store.
 */
export function useCompetitions(period: TimePeriod = 'all') {
  const competitions = useStore((state) => state.competitions)
  const setCompetitions = useStore((state) => state.setCompetitions)

  // Fetch competitions on mount (initial load before WebSocket connects)
  useEffect(() => {
    fetch(`${API_URL}/api/competitions`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setCompetitions(data.data)
        }
      })
      .catch(e => {
        console.error('[claude-rpg] Error fetching competitions:', e)
      })
  }, [setCompetitions])

  // Filter competitions by period
  const filtered = useMemo(() =>
    competitions.filter(c => c.period === period),
    [competitions, period]
  )

  // Get competition by category for the current period
  const getByCategory = (category: string) =>
    filtered.find(c => c.category === category)

  return {
    competitions: filtered,
    allCompetitions: competitions,
    loading: false, // Store is always populated by WebSocket
    getByCategory,
  }
}

/**
 * Get a specific competition by category and period.
 */
export function useCompetition(category: string, period: TimePeriod): Competition | undefined {
  return useStore((state) =>
    state.competitions.find(c => c.category === category && c.period === period)
  )
}
