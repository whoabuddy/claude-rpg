import type { TeamStats, PersonaContribution } from '../types/project'
import { levelFromTotalXP } from '@shared/types'

interface TeamStatsProps {
  teamStats: TeamStats | null
  loading: boolean
}

// Format number with K/M suffixes
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toLocaleString()
}

// Get intensity class for activity heatmap (0-100 scale)
function getIntensityClass(value: number, max: number): string {
  if (max === 0) return 'bg-rpg-border'
  const percentage = (value / max) * 100
  if (percentage >= 75) return 'bg-rpg-gold'
  if (percentage >= 50) return 'bg-rpg-accent'
  if (percentage >= 25) return 'bg-rpg-accent/60'
  if (percentage > 0) return 'bg-rpg-accent/30'
  return 'bg-rpg-border'
}

export function TeamStats({ teamStats, loading }: TeamStatsProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-3">Team Stats</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-rpg-text-dim">Loading team stats...</div>
        </div>
      </div>
    )
  }

  if (!teamStats || teamStats.totalXp === 0) {
    return (
      <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-3">Team Stats</h2>
        <div className="text-sm text-rpg-text-dim">No team activity yet.</div>
      </div>
    )
  }

  const { level } = levelFromTotalXP(teamStats.totalXp)

  // Get top tools sorted by usage
  const topTools = Object.entries(teamStats.topTools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Get day names in order (Sunday - Saturday)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const maxActivity = Math.max(...dayNames.map(day => teamStats.activityByDay[day] || 0), 1)

  return (
    <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4 space-y-4">
      <h2 className="text-sm font-medium text-rpg-text mb-3">Team Stats</h2>

      {/* Total XP and Level */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-rpg-text-muted mb-1">Team XP</div>
          <div className="text-2xl font-bold text-rpg-accent tabular-nums">
            {formatNumber(teamStats.totalXp)}
          </div>
        </div>
        <div className="px-3 py-1 bg-rpg-accent/20 text-rpg-accent text-sm font-bold rounded">
          Level {level}
        </div>
      </div>

      {/* Team Size */}
      <div>
        <div className="text-xs text-rpg-text-muted mb-1">Team Size</div>
        <div className="text-lg font-bold text-rpg-text tabular-nums">
          {teamStats.uniquePersonas} {teamStats.uniquePersonas === 1 ? 'contributor' : 'contributors'}
        </div>
      </div>

      {/* Contribution Bar Chart */}
      {teamStats.personaContributions.length > 0 && (
        <div>
          <div className="text-xs text-rpg-text-muted mb-2">Contributions</div>
          <div className="space-y-2">
            {teamStats.personaContributions.map((contrib: PersonaContribution) => (
              <div key={contrib.personaId}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-rpg-text truncate">{contrib.personaName}</span>
                  <span className="text-rpg-text-dim tabular-nums">{contrib.percentage}%</span>
                </div>
                <div className="w-full bg-rpg-border rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rpg-accent to-rpg-gold transition-all duration-300"
                    style={{ width: `${contrib.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-rpg-text-dim mt-1">
                  {formatNumber(contrib.xp)} XP · {contrib.commits} commits
                  {contrib.topTools.length > 0 && ` · ${contrib.topTools.slice(0, 2).join(', ')}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Tools */}
      {topTools.length > 0 && (
        <div>
          <div className="text-xs text-rpg-text-muted mb-2">Top Tools</div>
          <div className="flex flex-wrap gap-2">
            {topTools.map(([tool, count]) => (
              <div
                key={tool}
                className="px-2 py-1 bg-rpg-card border border-rpg-border rounded text-xs"
              >
                <span className="text-rpg-text font-medium">{tool}</span>
                <span className="text-rpg-text-dim ml-1 tabular-nums">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Heatmap */}
      <div>
        <div className="text-xs text-rpg-text-muted mb-2">Activity by Day</div>
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(day => {
            const count = teamStats.activityByDay[day] || 0
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={`w-full aspect-square rounded ${getIntensityClass(count, maxActivity)}`}
                  title={`${day}: ${count} events`}
                />
                <div className="text-xs text-rpg-text-dim">{day.slice(0, 3)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
