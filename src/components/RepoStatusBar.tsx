import { memo } from 'react'
import type { RepoInfo } from '@shared/types'

interface RepoStatusBarProps {
  repo: RepoInfo
  compact?: boolean
}

export const RepoStatusBar = memo(function RepoStatusBar({ repo, compact = false }: RepoStatusBarProps) {
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'} truncate`}>
      <span className="text-rpg-accent">
        {repo.org ? `${repo.org}/${repo.name}` : repo.name}
      </span>
      {repo.branch && (
        <>
          <span className="text-rpg-text-dim">:</span>
          <span className="text-rpg-working">{repo.branch}</span>
        </>
      )}
      {(repo.ahead !== undefined && repo.ahead > 0) && (
        <span className="text-rpg-success" title={`${repo.ahead} ahead`}>↑{repo.ahead}</span>
      )}
      {(repo.behind !== undefined && repo.behind > 0) && (
        <span className="text-rpg-error" title={`${repo.behind} behind`}>↓{repo.behind}</span>
      )}
      {repo.isDirty && (
        <span className="text-rpg-waiting" title="Uncommitted changes">●</span>
      )}
    </div>
  )
})
