import { useState, useEffect } from 'react'
import type { Competition, TimePeriod } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

export function useCompetitions(period: TimePeriod = 'all') {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch competitions on mount
  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/api/competitions`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setCompetitions(data.data)
        }
        setLoading(false)
      })
      .catch(e => {
        console.error('[claude-rpg] Error fetching competitions:', e)
        setLoading(false)
      })
  }, [])

  // Listen for WebSocket updates
  useEffect(() => {
    const handleUpdate = (e: CustomEvent<Competition[]>) => {
      setCompetitions(e.detail)
    }

    window.addEventListener('competitions_update', handleUpdate as EventListener)
    return () => window.removeEventListener('competitions_update', handleUpdate as EventListener)
  }, [])

  // Filter competitions by period
  const filtered = competitions.filter(c => c.period === period)

  // Get competition by category for the current period
  const getByCategory = (category: string) =>
    filtered.find(c => c.category === category)

  return {
    competitions: filtered,
    allCompetitions: competitions,
    loading,
    getByCategory,
  }
}
