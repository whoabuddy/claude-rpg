import { useState, useEffect } from 'react'
import type { TerminalOutput } from '@shared/types'

// Store terminal content by pane ID (bounded LRU-style cache)
const MAX_CACHED_PANES = 50
const terminalContentByPane = new Map<string, string>()
const paneAccessOrder: string[] = [] // Track access order for LRU eviction

// Initialization state
let initialized = false
let cleanupFn: (() => void) | null = null

function updateCache(paneId: string, content: string): void {
  // Update access order (move to end)
  const existingIndex = paneAccessOrder.indexOf(paneId)
  if (existingIndex !== -1) {
    paneAccessOrder.splice(existingIndex, 1)
  }
  paneAccessOrder.push(paneId)

  // Store content
  terminalContentByPane.set(paneId, content)

  // Evict oldest if over limit
  while (paneAccessOrder.length > MAX_CACHED_PANES) {
    const oldest = paneAccessOrder.shift()
    if (oldest) {
      terminalContentByPane.delete(oldest)
    }
  }
}

function removeFromCache(paneId: string): void {
  terminalContentByPane.delete(paneId)
  const index = paneAccessOrder.indexOf(paneId)
  if (index !== -1) {
    paneAccessOrder.splice(index, 1)
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
    removeFromCache(e.detail.paneId)
  }

  window.addEventListener('terminal_output', handleTerminalOutput as EventListener)
  window.addEventListener('pane_removed', handlePaneRemoved as EventListener)

  cleanupFn = () => {
    window.removeEventListener('terminal_output', handleTerminalOutput as EventListener)
    window.removeEventListener('pane_removed', handlePaneRemoved as EventListener)
    terminalContentByPane.clear()
    paneAccessOrder.length = 0
    initialized = false
    cleanupFn = null
  }

  return cleanupFn
}

// Export for testing/debugging
export function getTerminalCacheSize(): number {
  return terminalContentByPane.size
}
