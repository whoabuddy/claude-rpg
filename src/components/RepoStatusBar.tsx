import { memo } from 'react'
import type { RepoInfo } from '@shared/types'

interface RepoStatusBarProps {
  repo: RepoInfo
  compact?: boolean
}

export const RepoStatusBar = memo(function RepoStatusBar({ repo, compact = false }: RepoStatusBarProps) {
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'} min-w-0`}>
      <span className="text-rpg-accent truncate min-w-0">
        <span className="sm:hidden">{repo.name}</span>
        <span className="hidden sm:inline">{repo.org ? `${repo.org}/${repo.name}` : repo.name}</span>
      </span>
      {repo.branch && !compact && (
        <>
          <span className="text-rpg-text-dim flex-shrink-0">:</span>
          <span className="text-rpg-working flex-shrink-0">{repo.branch}</span>
        </>
      )}
      {(repo.ahead !== undefined && repo.ahead > 0) && (
        <span className="text-rpg-success flex-shrink-0" title={`${repo.ahead} ahead`}>↑{repo.ahead}</span>
      )}
      {(repo.behind !== undefined && repo.behind > 0) && (
        <span className="text-rpg-error flex-shrink-0" title={`${repo.behind} behind`}>↓{repo.behind}</span>
      )}
      {repo.isDirty && (
        <span className="text-rpg-waiting flex-shrink-0" title="Uncommitted changes">●</span>
      )}
    </div>
  )
})
