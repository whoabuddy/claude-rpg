import { memo } from 'react'
import type { SessionStats } from '@shared/types'

interface SessionStatsBarProps {
  stats: SessionStats | undefined
}

export const SessionStatsBar = memo(function SessionStatsBar({ stats }: SessionStatsBarProps) {
  if (!stats || stats.totalXPGained === 0) return null

  // Calculate total tools used
  const totalTools = Object.values(stats.toolsUsed).reduce((sum, count) => sum + count, 0)

  const parts: string[] = []
  parts.push(`+${stats.totalXPGained} XP`)
  if (totalTools > 0) parts.push(`${totalTools} tools`)
  if (stats.git.commits > 0) parts.push(`${stats.git.commits} commit${stats.git.commits > 1 ? 's' : ''}`)
  if (stats.git.prsCreated > 0) parts.push(`${stats.git.prsCreated} PR${stats.git.prsCreated > 1 ? 's' : ''}`)
  if (stats.commands.testsRun > 0) parts.push(`${stats.commands.testsRun} test${stats.commands.testsRun > 1 ? 's' : ''}`)

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-rpg-accent/10 rounded text-xs text-rpg-accent">
      <span className="text-rpg-text-dim">This session:</span>
      <span className="font-mono">{parts.join(' | ')}</span>
    </div>
  )
})
