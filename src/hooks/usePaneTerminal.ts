import { useState, useEffect } from 'react'
import type { TerminalOutput } from '@shared/types'

// Store terminal content by pane ID
const terminalContentByPane = new Map<string, string>()

export function usePaneTerminal(paneId: string | null): string | null {
  const [content, setContent] = useState<string | null>(
    paneId ? terminalContentByPane.get(paneId) || null : null
  )

  useEffect(() => {
    if (!paneId) {
      setContent(null)
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
  const handleTerminalOutput = (e: CustomEvent<TerminalOutput>) => {
    terminalContentByPane.set(e.detail.paneId, e.detail.content)
  }

  window.addEventListener('terminal_output', handleTerminalOutput as EventListener)
}
