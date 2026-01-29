import { useEffect, useCallback } from 'react'
import { useStore } from '../store'
import type { Quest, QuestStatus } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

/**
 * Update quest status (pause/resume/complete)
 */
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

/**
 * Archive quest (compute stats from event history)
 */
export async function archiveQuest(questId: string): Promise<{ ok: boolean; data?: Quest; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/quests/${encodeURIComponent(questId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

/**
 * Hook to access quests from the Zustand store.
 * Fetches initial data on mount, WebSocket updates flow through store.
 */
export function useQuests() {
  const quests = useStore((state) => state.quests)
  const setQuests = useStore((state) => state.setQuests)

  // Fetch quests on mount (initial load before WebSocket connects)
  useEffect(() => {
    fetch(`${API_URL}/api/quests`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setQuests(data.data)
        }
      })
      .catch(e => {
        console.error('[claude-rpg] Error fetching quests:', e)
      })
  }, [setQuests])

  // Active quests
  const activeQuests = quests.filter(q => q.status === 'active')

  // Get quest for a specific repo
  const questForRepo = useCallback((repoName: string): Quest | undefined => {
    return quests.find(q => q.status === 'active' && q.repos.includes(repoName))
  }, [quests])

  return {
    quests,
    activeQuests,
    loading: false, // Store is always populated by WebSocket, no separate loading state
    questForRepo,
  }
}

/**
 * Get active quests from the store.
 */
export function useActiveQuests(): Quest[] {
  return useStore((state) => state.quests.filter(q => q.status === 'active'))
}
