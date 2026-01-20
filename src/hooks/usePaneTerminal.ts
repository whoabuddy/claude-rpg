import { useState, useEffect } from 'react'
import type { TerminalOutput } from '@shared/types'

// Store terminal content by pane ID
const terminalContentByPane = new Map<string, string>()

// Initialization guard
let initialized = false

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
        terminalContentByPane.set(paneId, e.detail.content)
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

// Global listener to update cache (run once in app)
export function initTerminalCache(): void {
  if (initialized) return
  initialized = true

  const handleTerminalOutput = (e: CustomEvent<TerminalOutput>) => {
    terminalContentByPane.set(e.detail.paneId, e.detail.content)
  }

  // Clean up cache when pane is removed
  const handlePaneRemoved = (e: CustomEvent<{ paneId: string }>) => {
    terminalContentByPane.delete(e.detail.paneId)
  }

  window.addEventListener('terminal_output', handleTerminalOutput as EventListener)
  window.addEventListener('pane_removed', handlePaneRemoved as EventListener)
}

// Export for testing/debugging
export function getTerminalCacheSize(): number {
  return terminalContentByPane.size
}
