import { memo } from 'react'
import type { ClaudeSessionInfo } from '@shared/types'

interface ClaudeActivityProps {
  session: ClaudeSessionInfo
}

export const ClaudeActivity = memo(function ClaudeActivity({ session }: ClaudeActivityProps) {
  const subagentCount = session.activeSubagents?.length || 0

  // Show last prompt if it has actual content (not empty/whitespace)
  if (session.lastPrompt && session.lastPrompt.trim()) {
    return (
      <span>
        <span className="text-rpg-text-dim">Prompt:</span> {session.lastPrompt}
        {subagentCount > 0 && <SubagentBadge count={subagentCount} />}
      </span>
    )
  }
  if (session.currentTool) {
    return (
      <span className="text-rpg-text-muted">
        {session.currentTool}
        {session.currentFile && `: ${session.currentFile.split('/').pop()}`}
        {subagentCount > 0 && <SubagentBadge count={subagentCount} />}
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

function SubagentBadge({ count }: { count: number }) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rpg-accent/15 text-rpg-accent text-[10px] leading-none font-medium">
      <span className="animate-pulse">*</span>
      {count} sub{count > 1 ? 's' : ''}
    </span>
  )
}
