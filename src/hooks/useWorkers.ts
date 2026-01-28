import { useState, useEffect } from 'react'
import type { ClaudeSessionInfo, TmuxPane } from '@shared/types'

const API_URL = ''  // Same origin, proxied by Vite in dev

export function useWorkers() {
  const [workers, setWorkers] = useState<ClaudeSessionInfo[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch workers on mount
  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/api/workers`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setWorkers(data.data)
        }
        setLoading(false)
      })
      .catch(e => {
        console.error('[claude-rpg] Error fetching workers:', e)
        setLoading(false)
      })
  }, [])

  // Listen for WebSocket updates
  useEffect(() => {
    // Initial workers list
    const handleInit = (e: CustomEvent<ClaudeSessionInfo[]>) => {
      setWorkers(e.detail)
      setLoading(false)
    }

    // Pane update may contain claudeSession
    const handlePaneUpdate = (e: CustomEvent<TmuxPane>) => {
      const pane = e.detail
      if (pane.process.type === 'claude' && pane.process.claudeSession) {
        setWorkers(prev => {
          const idx = prev.findIndex(w => w.id === pane.process.claudeSession!.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = pane.process.claudeSession!
            return updated
          }
          // New worker
          return [...prev, pane.process.claudeSession!]
        })
      }
    }

    window.addEventListener('workers_init', handleInit as EventListener)
    window.addEventListener('pane_update', handlePaneUpdate as EventListener)

    return () => {
      window.removeEventListener('workers_init', handleInit as EventListener)
      window.removeEventListener('pane_update', handlePaneUpdate as EventListener)
    }
  }, [])

  return { workers, loading }
}
