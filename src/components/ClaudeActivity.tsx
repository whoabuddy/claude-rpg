import { memo } from 'react'
import type { ClaudeSessionInfo } from '@shared/types'

interface ClaudeActivityProps {
  session: ClaudeSessionInfo
}

export const ClaudeActivity = memo(function ClaudeActivity({ session }: ClaudeActivityProps) {
  // Show last prompt if it has actual content (not empty/whitespace)
  if (session.lastPrompt && session.lastPrompt.trim()) {
    return <span><span className="text-rpg-text-dim">Prompt:</span> {session.lastPrompt}</span>
  }
  if (session.currentTool) {
    return (
      <span className="text-rpg-text-muted">
        {session.currentTool}
        {session.currentFile && `: ${session.currentFile.split('/').pop()}`}
      </span>
    )
  }
  if (session.status === 'waiting') {
    return <span className="text-rpg-waiting">Waiting for input...</span>
  }
  if (session.status === 'error' && session.lastError) {
    return <span className="text-rpg-error">Error in {session.lastError.tool}</span>
  }
  return <span className="text-rpg-text-dim">Ready</span>
})
