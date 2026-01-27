import { useState, useEffect, useCallback } from 'react'
import type { Quest } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

export function useQuests() {
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch quests on mount
  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/api/quests`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setQuests(data.data)
        }
        setLoading(false)
      })
      .catch(e => {
        console.error('[claude-rpg] Error fetching quests:', e)
        setLoading(false)
      })
  }, [])

  // Listen for WebSocket updates
  useEffect(() => {
    const handleQuestUpdate = (e: CustomEvent<Quest>) => {
      setQuests(prev => {
        const idx = prev.findIndex(q => q.id === e.detail.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = e.detail
          return next
        }
        return [...prev, e.detail]
      })
    }

    const handleQuestsInit = (e: CustomEvent<Quest[]>) => {
      setQuests(e.detail)
    }

    window.addEventListener('quest_update', handleQuestUpdate as EventListener)
    window.addEventListener('quests_init', handleQuestsInit as EventListener)
    return () => {
      window.removeEventListener('quest_update', handleQuestUpdate as EventListener)
      window.removeEventListener('quests_init', handleQuestsInit as EventListener)
    }
  }, [])

  // Active quests
  const activeQuests = quests.filter(q => q.status === 'active')

  // Get quest for a specific repo
  const questForRepo = useCallback((repoName: string): Quest | undefined => {
    return quests.find(q => q.status === 'active' && q.repos.includes(repoName))
  }, [quests])

  return {
    quests,
    activeQuests,
    loading,
    questForRepo,
  }
}
