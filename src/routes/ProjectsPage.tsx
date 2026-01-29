import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { levelFromTotalXP } from '../../shared/types'
import type { Companion } from '../../shared/types'

type SortBy = 'activity' | 'level' | 'name'

/**
 * Projects page - shows all git repositories with RPG stats
 */
export default function ProjectsPage() {
  const companions = useStore((state) => state.companions)
  const [sortBy, setSortBy] = useState<SortBy>('activity')

  // Sort companions
  const sortedCompanions = [...companions].sort((a, b) => {
    switch (sortBy) {
      case 'level':
        return b.totalExperience - a.totalExperience
      case 'name':
        return a.name.localeCompare(b.name)
      case 'activity':
      default:
        return b.lastActivity - a.lastActivity
    }
  })

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-rpg-text">Projects</h1>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-xs bg-rpg-card border border-rpg-border rounded px-2 py-1 text-rpg-text-muted focus:outline-none focus:border-rpg-accent"
          >
            <option value="activity">Recent</option>
            <option value="level">Level</option>
            <option value="name">Name</option>
          </select>
          <span className="text-sm text-rpg-text-muted">
            {companions.length} tracked
          </span>
        </div>
      </div>

      {/* Projects grid */}
      {sortedCompanions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCompanions.map(companion => (
            <ProjectCard key={companion.id} companion={companion} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-rpg-text-dim mb-2">No projects tracked yet</p>
          <p className="text-sm text-rpg-text-muted">
            Work on a git repository with Claude Code to start tracking
          </p>
        </div>
      )}
    </div>
  )
}

interface ProjectCardProps {
  companion: Companion
}

function ProjectCard({ companion }: ProjectCardProps) {
  const { level, currentXP, nextLevelXP } = levelFromTotalXP(companion.totalExperience)
  const xpProgress = (currentXP / nextLevelXP) * 100

  return (
    <Link
      to={`/projects/${companion.id}`}
      className="block p-4 rounded-lg border border-rpg-border bg-rpg-card hover:border-rpg-accent/50 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-rpg-text truncate">{companion.name}</span>
        <span className="px-2 py-0.5 text-xs font-bold bg-rpg-accent/20 text-rpg-accent rounded">
          Lv {level}
        </span>
      </div>

      {/* XP Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-rpg-text-muted mb-1">
          <span>{currentXP} XP</span>
          <span>{nextLevelXP} XP</span>
        </div>
        <div className="w-full h-1.5 bg-rpg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rpg-accent to-rpg-gold transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-rpg-text-muted">
        <span>{companion.stats.git.commits} commits</span>
        <span>{companion.stats.sessionsCompleted} sessions</span>
        {companion.streak.current > 0 && (
          <span className="text-rpg-streak">{companion.streak.current}d streak</span>
        )}
      </div>

      {/* Path */}
      <p className="mt-2 text-xs text-rpg-text-dim truncate font-mono">
        {companion.repo.path}
      </p>
    </Link>
  )
}
