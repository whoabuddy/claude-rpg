import { useState, useEffect, useCallback } from 'react'
import type { Quest, QuestStatus } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

// Update quest status (pause/resume/complete) (#81)
export async function updateQuestStatus(questId: string, status: QuestStatus): Promise<{ ok: boolean; data?: Quest; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/quests/${encodeURIComponent(questId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

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

    const handleQuestXP = (e: CustomEvent<{ questId: string; phaseId: string; xp: number; reason: string }>) => {
      const { questId, phaseId, xp } = e.detail
      setQuests(prev => {
        const idx = prev.findIndex(q => q.id === questId)
        if (idx < 0) return prev

        const next = [...prev]
        const quest = { ...next[idx] }

        // Update phase XP
        const phaseIdx = quest.phases.findIndex(p => p.id === phaseId)
        if (phaseIdx >= 0) {
          quest.phases = [...quest.phases]
          quest.phases[phaseIdx] = {
            ...quest.phases[phaseIdx],
            xpEarned: (quest.phases[phaseIdx].xpEarned || 0) + xp,
          }
        }

        // Update quest total XP
        quest.xpEarned = (quest.xpEarned || 0) + xp

        next[idx] = quest
        return next
      })
    }

    window.addEventListener('quest_update', handleQuestUpdate as EventListener)
    window.addEventListener('quests_init', handleQuestsInit as EventListener)
    window.addEventListener('quest_xp', handleQuestXP as EventListener)
    return () => {
      window.removeEventListener('quest_update', handleQuestUpdate as EventListener)
      window.removeEventListener('quests_init', handleQuestsInit as EventListener)
      window.removeEventListener('quest_xp', handleQuestXP as EventListener)
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
