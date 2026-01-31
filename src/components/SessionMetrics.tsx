import { memo } from 'react'
import type { ClaudeSessionInfo } from '@shared/types'

interface SessionMetricsProps {
  session: ClaudeSessionInfo
  compact?: boolean
}

export const SessionMetrics = memo(function SessionMetrics({ session, compact = false }: SessionMetricsProps) {
  const { tokens, activeSubagents, lastActivity } = session

  // Format token count (e.g., "12k" or "128k")
  const formatTokens = (n: number) => n >= 1000 ? `${Math.round(n/1000)}k` : String(n)

  // Format relative time
  const formatTime = (ts: number) => {
    const seconds = Math.floor((Date.now() - ts) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    return `${Math.floor(minutes / 60)}h`
  }

  if (compact) {
    // Ultra-compact: just tokens and subagent count
    return (
      <div className="flex items-center gap-2 text-xs text-rpg-text-dim">
        {tokens && <span title="Context tokens">{formatTokens(tokens.current)} ctx</span>}
        {activeSubagents && activeSubagents.length > 0 && (
          <span className="text-rpg-accent" title={`${activeSubagents.length} subagents running`}>
            +{activeSubagents.length}
          </span>
        )}
      </div>
    )
  }

  // Full version for expanded view
  return (
    <div className="flex items-center gap-3 text-xs">
      {tokens && (
        <span className="text-rpg-text-dim" title={`${tokens.current} current / ${tokens.cumulative} total`}>
          {formatTokens(tokens.current)} ctx
        </span>
      )}
      {activeSubagents && activeSubagents.length > 0 && (
        <span className="text-rpg-accent">
          {activeSubagents.length} agent{activeSubagents.length > 1 ? 's' : ''}
        </span>
      )}
      {lastActivity && (
        <span className="text-rpg-text-dim">
          {formatTime(lastActivity)} ago
        </span>
      )}
    </div>
  )
})
