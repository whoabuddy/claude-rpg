import { useState, useEffect } from 'react'
import type { TerminalOutput } from '@shared/types'

// Store terminal content by pane ID (bounded LRU cache using Map insertion order)
const MAX_CACHE_SIZE = 50
const terminalContentByPane = new Map<string, string>()

// Initialization state
let initialized = false
let cleanupFn: (() => void) | null = null

// Update cache with LRU eviction (Map maintains insertion order)
function updateCache(paneId: string, content: string): void {
  // Delete and re-add to move entry to end (most recently used)
  terminalContentByPane.delete(paneId)
  terminalContentByPane.set(paneId, content)

  // Evict oldest entries (first in Map) if over limit
  while (terminalContentByPane.size > MAX_CACHE_SIZE) {
    const oldest = terminalContentByPane.keys().next().value
    if (oldest) terminalContentByPane.delete(oldest)
  }
}

export function usePaneTerminal(paneId: string | null): string | undefined {
  const [content, setContent] = useState<string | undefined>(
    paneId ? terminalContentByPane.get(paneId) : undefined
  )

  useEffect(() => {
    if (!paneId) {
      setContent(undefined)
      return
    }

    // Get initial content from cache
    const cached = terminalContentByPane.get(paneId)
    if (cached) {
      setContent(cached)
    }

    const handleTerminalOutput = (e: CustomEvent<TerminalOutput>) => {
      if (e.detail.paneId === paneId) {
        updateCache(paneId, e.detail.content)
        setContent(e.detail.content)
      }
    }

    window.addEventListener('terminal_output', handleTerminalOutput as EventListener)

    return () => {
      window.removeEventListener('terminal_output', handleTerminalOutput as EventListener)
    }
  }, [paneId])

  return content
}

// Initialize global cache listeners - returns cleanup function
export function initTerminalCache(): () => void {
  if (initialized && cleanupFn) {
    return cleanupFn
  }
  initialized = true

  const handleTerminalOutput = (e: CustomEvent<TerminalOutput>) => {
    updateCache(e.detail.paneId, e.detail.content)
  }

  const handlePaneRemoved = (e: CustomEvent<{ paneId: string }>) => {
    terminalContentByPane.delete(e.detail.paneId)
  }

  window.addEventListener('terminal_output', handleTerminalOutput as EventListener)
  window.addEventListener('pane_removed', handlePaneRemoved as EventListener)

  cleanupFn = () => {
    window.removeEventListener('terminal_output', handleTerminalOutput as EventListener)
    window.removeEventListener('pane_removed', handlePaneRemoved as EventListener)
    terminalContentByPane.clear()
    initialized = false
    cleanupFn = null
  }

  return cleanupFn
}
