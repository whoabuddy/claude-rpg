import { useState, useEffect } from 'react'
import type { TerminalOutput } from '@shared/types'

export function useTerminalOutput(sessionId: string | null): string {
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    if (!sessionId) return

    const handleOutput = (e: CustomEvent<TerminalOutput>) => {
      if (e.detail.sessionId === sessionId) {
        setContent(e.detail.content)
      }
    }

    window.addEventListener('terminal_output', handleOutput as EventListener)
    return () => window.removeEventListener('terminal_output', handleOutput as EventListener)
  }, [sessionId])

  return content
}
