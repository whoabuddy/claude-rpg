import { useState, useEffect, useCallback } from 'react'
import type { TmuxWindow, TmuxPane, ServerMessage } from '@shared/types'

const API_URL = '' // Same origin, proxied by Vite in dev

export function useWindows() {
  const [windows, setWindows] = useState<TmuxWindow[]>([])
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null)
  const [selectedPaneId, setSelectedPaneId] = useState<string | null>(null)

  // Fetch windows on mount
  useEffect(() => {
    fetch(`${API_URL}/api/windows`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setWindows(data.data)
          // Select first window if none selected
          if (data.data.length > 0 && !selectedWindowId) {
            setSelectedWindowId(data.data[0].id)
          }
        }
      })
      .catch(e => console.error('[claude-rpg] Error fetching windows:', e))
  }, [])

  // Listen for windows updates via custom event
  useEffect(() => {
    const handleWindowsUpdate = (e: CustomEvent<TmuxWindow[]>) => {
      setWindows(e.detail)
    }

    const handlePaneUpdate = (e: CustomEvent<TmuxPane>) => {
      setWindows(prev => {
        return prev.map(window => ({
          ...window,
          panes: window.panes.map(pane =>
            pane.id === e.detail.id ? e.detail : pane
          ),
        }))
      })
    }

    const handlePaneRemoved = (e: CustomEvent<{ paneId: string }>) => {
      setWindows(prev => {
        return prev.map(window => ({
          ...window,
          panes: window.panes.filter(pane => pane.id !== e.detail.paneId),
        }))
      })
      // Deselect if removed pane was selected
      if (selectedPaneId === e.detail.paneId) {
        setSelectedPaneId(null)
      }
    }

    window.addEventListener('windows_update', handleWindowsUpdate as EventListener)
    window.addEventListener('pane_update', handlePaneUpdate as EventListener)
    window.addEventListener('pane_removed', handlePaneRemoved as EventListener)

    return () => {
      window.removeEventListener('windows_update', handleWindowsUpdate as EventListener)
      window.removeEventListener('pane_update', handlePaneUpdate as EventListener)
      window.removeEventListener('pane_removed', handlePaneRemoved as EventListener)
    }
  }, [selectedPaneId])

  // Get selected window
  const selectedWindow = windows.find(w => w.id === selectedWindowId)

  // Get selected pane
  const selectedPane = selectedWindow?.panes.find(p => p.id === selectedPaneId)

  // Get all Claude panes across all windows
  const claudePanes = windows.flatMap(w =>
    w.panes.filter(p => p.process.type === 'claude')
  )

  // Get panes that need attention (waiting or error)
  const attentionPanes = claudePanes.filter(p =>
    p.process.claudeSession?.status === 'waiting' ||
    p.process.claudeSession?.status === 'error'
  )

  return {
    windows,
    selectedWindowId,
    setSelectedWindowId,
    selectedWindow,
    selectedPaneId,
    setSelectedPaneId,
    selectedPane,
    claudePanes,
    attentionPanes,
  }
}

// Helper to send prompts to a pane
export async function sendPromptToPane(paneId: string, prompt: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/panes/${encodeURIComponent(paneId)}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    return data.ok
  } catch (e) {
    console.error('[claude-rpg] Error sending prompt to pane:', e)
    return false
  }
}
