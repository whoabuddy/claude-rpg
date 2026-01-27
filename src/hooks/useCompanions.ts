import { useState, useEffect } from 'react'
import type { Companion, ClaudeEvent, ServerMessage } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

export function useCompanions(events: ClaudeEvent[]) {
  const [companions, setCompanions] = useState<Companion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fetch companions on mount
  useEffect(() => {
    fetch(`${API_URL}/api/companions`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setCompanions(data.data)
          // Select first companion if none selected
          if (data.data.length > 0 && !selectedId) {
            setSelectedId(data.data[0].id)
          }
        }
      })
      .catch(e => console.error('[claude-rpg] Error fetching companions:', e))
  }, [])

  // Update companions from WebSocket events
  useEffect(() => {
    // Listen for companion updates via custom event
    const handleUpdate = (e: CustomEvent<Companion>) => {
      setCompanions(prev => {
        const idx = prev.findIndex(c => c.id === e.detail.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = e.detail
          return updated
        }
        return [...prev, e.detail]
      })
    }

    window.addEventListener('companion_update', handleUpdate as EventListener)
    return () => window.removeEventListener('companion_update', handleUpdate as EventListener)
  }, [])

  return { companions, selectedId, setSelectedId }
}

// Helper to send prompts to a companion
export async function sendPrompt(companionId: string, prompt: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/companions/${companionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    return data.ok
  } catch (e) {
    console.error('[claude-rpg] Error sending prompt:', e)
    return false
  }
}

