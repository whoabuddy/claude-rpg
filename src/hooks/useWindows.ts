import { useState, useEffect, useCallback } from 'react'
import type { TmuxWindow, TmuxPane, ServerMessage } from '@shared/types'

const API_URL = '' // Same origin, proxied by Vite in dev

// Deep equality check for windows array - only compares fields that affect rendering
function windowsEqual(a: TmuxWindow[], b: TmuxWindow[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const wa = a[i], wb = b[i]
    if (wa.id !== wb.id || wa.windowName !== wb.windowName) return false
    if (wa.panes.length !== wb.panes.length) return false
    for (let j = 0; j < wa.panes.length; j++) {
      const pa = wa.panes[j], pb = wb.panes[j]
      if (pa.id !== pb.id) return false
      if (pa.process.type !== pb.process.type) return false
      if (pa.process.typing !== pb.process.typing) return false
      if (pa.process.command !== pb.process.command) return false
      // Compare Claude session state
      const sa = pa.process.claudeSession, sb = pb.process.claudeSession
      if (!!sa !== !!sb) return false
      if (sa && sb) {
        if (sa.status !== sb.status) return false
        if (sa.name !== sb.name) return false
        if (sa.currentTool !== sb.currentTool) return false
        if (sa.lastPrompt !== sb.lastPrompt) return false
        if (!!sa.pendingQuestion !== !!sb.pendingQuestion) return false
        if (sa.pendingQuestion?.toolUseId !== sb.pendingQuestion?.toolUseId) return false
        if (sa.lastError?.timestamp !== sb.lastError?.timestamp) return false
      }
    }
  }
  return true
}

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
      // Only update state if windows actually changed (prevents unnecessary re-renders)
      setWindows(prev => windowsEqual(prev, e.detail) ? prev : e.detail)
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
  } catch {
    return false
  }
}

// Helper to send signals (e.g., SIGINT for Ctrl+C) to a pane
export async function sendSignalToPane(paneId: string, signal: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/panes/${encodeURIComponent(paneId)}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal }),
    })
    const data = await res.json()
    return data.ok
  } catch {
    return false
  }
}

// Helper to dismiss waiting status (set to ready)
export async function dismissWaiting(paneId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/panes/${encodeURIComponent(paneId)}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    return data.ok
  } catch {
    return false
  }
}

// Helper to refresh pane (scroll to bottom, reset state, refresh terminal)
export async function refreshPane(paneId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/panes/${encodeURIComponent(paneId)}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    return data.ok
  } catch {
    return false
  }
}

// Helper to close pane
export async function closePane(paneId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/panes/${encodeURIComponent(paneId)}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    return data.ok
  } catch {
    return false
  }
}

// Helper to create new pane in window (auto-balanced)
export async function createPaneInWindow(windowId: string): Promise<{ ok: boolean; paneCount?: number; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/windows/${encodeURIComponent(windowId)}/new-pane`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

// Helper to create new Claude pane in window (auto-balanced)
export async function createClaudeInWindow(windowId: string): Promise<{ ok: boolean; paneCount?: number; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/windows/${encodeURIComponent(windowId)}/new-claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Network error' }
  }
}
