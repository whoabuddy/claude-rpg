import { memo } from 'react'
import type { RepoInfo } from '@shared/types'

interface GitHubLinksProps {
  repo: RepoInfo
}

export const GitHubLinks = memo(function GitHubLinks({ repo }: GitHubLinksProps) {
  if (!repo.org) return null

  const baseUrl = `https://github.com/${repo.org}/${repo.name}`

  const links = [
    { label: 'Repo', url: baseUrl, icon: '📁' },
    { label: 'Issues', url: `${baseUrl}/issues`, icon: '🐛' },
    { label: 'PRs', url: `${baseUrl}/pulls`, icon: '🔀' },
  ]

  // Add "Create PR" if on a non-default branch
  if (repo.branch && repo.defaultBranch && repo.branch !== repo.defaultBranch) {
    links.push({
      label: 'New PR',
      url: `${baseUrl}/compare/${repo.defaultBranch}...${repo.branch}?expand=1`,
      icon: '➕',
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Fork info */}
      {repo.upstream && (
        <span className="text-xs text-rpg-text-muted">
          ↳ fork of{' '}
          <a
            href={`https://github.com/${repo.upstream.org}/${repo.upstream.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rpg-accent hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {repo.upstream.org}/{repo.upstream.name}
          </a>
        </span>
      )}

      {/* Quick links - mobile-friendly with labels and larger touch targets */}
      <div className="flex flex-wrap gap-2">
        {links.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-rpg-bg-elevated hover:bg-rpg-border rounded transition-colors min-h-[44px]"
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
})
