import { useState, useEffect, useRef, useMemo } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'

const API_URL = '' // Same origin, proxied by Vite in dev

// Shallow equality check for a single pane - compares fields that affect rendering
function paneEqual(a: TmuxPane, b: TmuxPane): boolean {
  if (a.id !== b.id) return false
  if (a.process.type !== b.process.type) return false
  if (a.process.typing !== b.process.typing) return false
  if (a.process.command !== b.process.command) return false
  if (a.cwd !== b.cwd) return false
  // Compare Claude session state
  const sa = a.process.claudeSession, sb = b.process.claudeSession
  if (!!sa !== !!sb) return false
  if (sa && sb) {
    if (sa.status !== sb.status) return false
    if (sa.name !== sb.name) return false
    if (sa.avatarSvg !== sb.avatarSvg) return false
    if (sa.currentTool !== sb.currentTool) return false
    if (sa.currentFile !== sb.currentFile) return false
    if (sa.lastPrompt !== sb.lastPrompt) return false
    if (!!sa.pendingQuestion !== !!sb.pendingQuestion) return false
    if (sa.pendingQuestion?.toolUseId !== sb.pendingQuestion?.toolUseId) return false
    if (!!sa.terminalPrompt !== !!sb.terminalPrompt) return false
    if (sa.terminalPrompt?.contentHash !== sb.terminalPrompt?.contentHash) return false
    if (sa.lastError?.timestamp !== sb.lastError?.timestamp) return false
    if (sa.stats?.totalXPGained !== sb.stats?.totalXPGained) return false
  }
  // Compare repo
  if (a.repo?.name !== b.repo?.name) return false
  if (a.repo?.org !== b.repo?.org) return false
  if (a.repo?.branch !== b.repo?.branch) return false
  if (a.repo?.isDirty !== b.repo?.isDirty) return false
  if (a.repo?.ahead !== b.repo?.ahead) return false
  if (a.repo?.behind !== b.repo?.behind) return false
  return true
}

// Deep equality check for windows array using paneEqual
function windowsEqual(a: TmuxWindow[], b: TmuxWindow[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const wa = a[i], wb = b[i]
    if (wa.id !== wb.id || wa.windowName !== wb.windowName) return false
    if (wa.panes.length !== wb.panes.length) return false
    for (let j = 0; j < wa.panes.length; j++) {
      if (!paneEqual(wa.panes[j], wb.panes[j])) return false
    }
  }
  return true
}

export function useWindows() {
  const [windows, setWindows] = useState<TmuxWindow[]>([])

  // Fetch windows on mount
  useEffect(() => {
    fetch(`${API_URL}/api/windows`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.data) {
          setWindows(data.data)
        }
      })
      .catch(e => console.error('[claude-rpg] Error fetching windows:', e))
  }, [])

  // Listen for windows updates via custom event (stable - no deps that change)
  useEffect(() => {
    const handleWindowsUpdate = (e: CustomEvent<TmuxWindow[]>) => {
      // Only update state if windows actually changed (prevents unnecessary re-renders)
      setWindows(prev => windowsEqual(prev, e.detail) ? prev : e.detail)
    }

    const handlePaneUpdate = (e: CustomEvent<TmuxPane>) => {
      setWindows(prev => {
        const windowIndex = prev.findIndex(w =>
          w.panes.some(p => p.id === e.detail.id)
        )
        if (windowIndex === -1) return prev

        const targetWindow = prev[windowIndex]
        const paneIndex = targetWindow.panes.findIndex(p => p.id === e.detail.id)
        if (paneIndex === -1) return prev

        // Skip update if pane hasn't visually changed
        if (paneEqual(targetWindow.panes[paneIndex], e.detail)) return prev

        const newPanes = [...targetWindow.panes]
        newPanes[paneIndex] = e.detail

        const newWindows = [...prev]
        newWindows[windowIndex] = { ...targetWindow, panes: newPanes }
        return newWindows
      })
    }

    const handlePaneRemoved = (e: CustomEvent<{ paneId: string }>) => {
      setWindows(prev => {
        return prev.map(window => ({
          ...window,
          panes: window.panes.filter(pane => pane.id !== e.detail.paneId),
        }))
      })
    }

    window.addEventListener('windows_update', handleWindowsUpdate as EventListener)
    window.addEventListener('pane_update', handlePaneUpdate as EventListener)
    window.addEventListener('pane_removed', handlePaneRemoved as EventListener)

    return () => {
      window.removeEventListener('windows_update', handleWindowsUpdate as EventListener)
      window.removeEventListener('pane_update', handlePaneUpdate as EventListener)
      window.removeEventListener('pane_removed', handlePaneRemoved as EventListener)
    }
  }, []) // Empty deps - listeners only attached once

  // Get all Claude panes across all windows (memoized to prevent unnecessary re-renders)
  const claudePanes = useMemo(() =>
    windows.flatMap(w => w.panes.filter(p => p.process.type === 'claude')),
    [windows]
  )

  // Get panes that need attention (waiting or error)
  const attentionPanes = useMemo(() =>
    claudePanes.filter(p =>
      p.process.claudeSession?.status === 'waiting' ||
      p.process.claudeSession?.status === 'error'
    ),
    [claudePanes]
  )

  return {
    windows,
    claudePanes,
    attentionPanes,
  }
}

// Generic POST helper — eliminates repeated fetch/try-catch boilerplate
async function apiPost<T extends { ok: boolean }>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Network error' } as unknown as T
  }
}

function panePath(paneId: string, action: string) {
  return `/api/panes/${encodeURIComponent(paneId)}/${action}`
}

function windowPath(windowId: string, action: string) {
  return `/api/windows/${encodeURIComponent(windowId)}/${action}`
}

// Send prompt to a pane
export async function sendPromptToPane(
  paneId: string,
  prompt: string,
  options?: { isPermissionResponse?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const data = await apiPost<{ ok: boolean; error?: string }>(
    panePath(paneId, 'prompt'),
    { prompt, ...(options?.isPermissionResponse && { isPermissionResponse: true }) },
  )
  if (!data.ok) console.error('[sendPromptToPane] Server returned error:', data.error)
  return data
}

// Send signal (e.g., SIGINT for Ctrl+C) to a pane
export async function sendSignalToPane(paneId: string, signal: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'signal'), { signal })).ok
}

// Dismiss waiting status (set to ready)
export async function dismissWaiting(paneId: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'dismiss'))).ok
}

// Refresh pane (scroll to bottom, reset state, refresh terminal)
export async function refreshPane(paneId: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'refresh'))).ok
}

// Close pane
export async function closePane(paneId: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'close'))).ok
}

// Create new pane in window (auto-balanced)
export function createPaneInWindow(windowId: string) {
  return apiPost<{ ok: boolean; paneCount?: number; error?: string }>(windowPath(windowId, 'new-pane'))
}

// Create new Claude pane in window (auto-balanced)
export function createClaudeInWindow(windowId: string) {
  return apiPost<{ ok: boolean; paneCount?: number; error?: string }>(windowPath(windowId, 'new-claude'))
}

// Create new window in session
export function createWindow(sessionName: string, windowName: string) {
  return apiPost<{ ok: boolean; sessionName?: string; windowName?: string; error?: string }>(
    '/api/windows/create', { sessionName, windowName },
  )
}

// Rename a window
export function renameWindow(windowId: string, windowName: string) {
  return apiPost<{ ok: boolean; error?: string }>(windowPath(windowId, 'rename'), { windowName })
}
