interface PersonaBadgesProps {
  badges: string[]
  max?: number  // Max to show before "+N more"
}

// Badge definitions (synced with server-v2/personas/badges.ts)
const BADGE_INFO: Record<string, { icon: string; name: string }> = {
  code_architect: { icon: '🏗️', name: 'Code Architect' },
  test_champion: { icon: '🧪', name: 'Test Champion' },
  git_master: { icon: '📝', name: 'Git Master' },
  shell_sage: { icon: '💻', name: 'Shell Sage' },
  wordsmith: { icon: '✍️', name: 'Wordsmith' },
  clarity_coder: { icon: '⚡', name: 'Clarity Coder' },
}

export function PersonaBadges({ badges, max = 3 }: PersonaBadgesProps) {
  if (badges.length === 0) return null

  const visibleBadges = badges.slice(0, max)
  const remainingCount = badges.length - max

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visibleBadges.map((badgeId) => {
        const info = BADGE_INFO[badgeId]
        if (!info) return null

        return (
          <div
            key={badgeId}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-rpg-bg border border-rpg-border text-xs"
            title={info.name}
          >
            <span>{info.icon}</span>
            <span className="text-rpg-text-muted">{info.name}</span>
          </div>
        )
      })}
      {remainingCount > 0 && (
        <span className="text-xs text-rpg-text-dim">+{remainingCount} more</span>
      )}
    </div>
  )
}
