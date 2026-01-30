import { Link } from 'react-router-dom'
import { levelFromTotalXP } from '../../shared/types'
import type { Companion } from '../../shared/types'

interface ProjectMiniCardProps {
  companion: Companion
}

export function ProjectMiniCard({ companion }: ProjectMiniCardProps) {
  const { level } = levelFromTotalXP(companion.totalExperience)

  return (
    <Link
      to={`/projects/${companion.id}`}
      className="p-3 bg-rpg-card border border-rpg-border rounded-lg hover:border-rpg-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-rpg-text text-sm truncate">
          {companion.name}
        </span>
        <span className="text-xs bg-rpg-accent/20 text-rpg-accent px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
          Lv {level}
        </span>
      </div>
      <div className="flex gap-3 text-xs text-rpg-text-muted">
        <span>{companion.stats.git.commits} commits</span>
        {companion.streak.current > 0 && (
          <span className="text-rpg-streak">{companion.streak.current}d</span>
        )}
      </div>
    </Link>
  )
}
