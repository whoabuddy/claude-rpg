import type { Competition, LeaderboardEntry, CompetitionCategory } from '@shared/types'

interface LeaderboardCardProps {
  competition: Competition | undefined
  title: string
  unit: string
  emptyMessage?: string
}

// Trophy/medal icons for top 3
function TrophyIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    // Gold trophy
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path d="M12 15c-2.21 0-4-1.79-4-4V4h8v7c0 2.21-1.79 4-4 4z" fill="#FFD700" stroke="#DAA520" strokeWidth="1"/>
        <path d="M8 4H5c0 2.5 1.5 4 3 4V4z" fill="#FFD700" stroke="#DAA520" strokeWidth="1"/>
        <path d="M16 4h3c0 2.5-1.5 4-3 4V4z" fill="#FFD700" stroke="#DAA520" strokeWidth="1"/>
        <path d="M9 15h6v2H9z" fill="#FFD700"/>
        <path d="M7 17h10v3H7z" fill="#DAA520"/>
      </svg>
    )
  }
  if (rank === 2) {
    // Silver medal
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" fill="#C0C0C0" stroke="#A8A8A8" strokeWidth="1"/>
        <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#666" fontWeight="bold">2</text>
      </svg>
    )
  }
  if (rank === 3) {
    // Bronze medal
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" fill="#CD7F32" stroke="#8B4513" strokeWidth="1"/>
        <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#4a2c0a" fontWeight="bold">3</text>
      </svg>
    )
  }
  return null
}

function getRankDisplay(rank: number): string | null {
  // Top 3 use icons instead
  if (rank <= 3) return null
  return String(rank)
}

function getRankClass(rank: number): string {
  switch (rank) {
    case 1: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
    case 2: return 'bg-gray-400/20 text-gray-300 border-gray-400/50'
    case 3: return 'bg-orange-600/20 text-orange-400 border-orange-600/50'
    default: return 'bg-rpg-card text-rpg-idle border-rpg-border/30'
  }
}

function formatValue(value: number, category: CompetitionCategory): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toLocaleString()
}

function EntryRow({ entry, unit, category }: { entry: LeaderboardEntry; unit: string; category: CompetitionCategory }) {
  const isTopThree = entry.rank <= 3
  const rankText = getRankDisplay(entry.rank)

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
        isTopThree ? 'bg-rpg-card/50' : ''
      }`}
    >
      {/* Rank badge - trophy for top 3, number badge for others */}
      <span
        className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded border ${getRankClass(entry.rank)}`}
      >
        {isTopThree ? <TrophyIcon rank={entry.rank} /> : rankText}
      </span>

      {/* Name */}
      <span className="flex-1 text-sm truncate text-rpg-text/90">
        {entry.companionName}
      </span>

      {/* Streak indicator */}
      {entry.streak.current > 0 && (
        <span className="text-xs text-rpg-waiting" title={`${entry.streak.current} day streak`}>
          {entry.streak.current}d
        </span>
      )}

      {/* Value */}
      <span className="text-sm font-mono text-rpg-accent tabular-nums">
        {formatValue(entry.value, category)}
      </span>
      <span className="text-xs text-rpg-idle/60 w-10">
        {unit}
      </span>
    </div>
  )
}

export function LeaderboardCard({
  competition,
  title,
  unit,
  emptyMessage = 'No data yet',
}: LeaderboardCardProps) {
  const entries = competition?.entries ?? []
  const filteredEntries = entries.filter(e => e.value > 0)

  return (
    <div className="rounded-lg border border-rpg-border/50 bg-rpg-bg/50">
      {/* Header */}
      <div className="px-3 py-2 border-b border-rpg-border/30">
        <h3 className="text-sm font-medium text-rpg-text">{title}</h3>
      </div>

      {/* Entries */}
      <div className="p-2 space-y-1">
        {filteredEntries.length === 0 ? (
          <p className="text-center text-sm text-rpg-idle/60 py-4">{emptyMessage}</p>
        ) : (
          filteredEntries.slice(0, 5).map(entry => (
            <EntryRow
              key={entry.companionId}
              entry={entry}
              unit={unit}
              category={competition!.category}
            />
          ))
        )}
      </div>
    </div>
  )
}

// Fire icon for streaks
function FireIcon() {
  return (
    <svg className="w-3.5 h-3.5 inline-block" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2c0 4-3 6-3 10 0 3.31 2.69 6 6 6 1.66 0 3.16-.67 4.24-1.76C18.16 17.33 17 18.99 15 20c-4 2-8 0-9-4-.5-2 0-4 1-6 .5-1 1.5-3 2-4 1-2 3-4 3-4z"
        fill="#FF6B35"
        stroke="#FF4500"
        strokeWidth="1"
      />
      <path
        d="M12 22c-2.21 0-4-1.79-4-4 0-2 2-4 2-4s2 2 2 4c0 2.21-0 4 0 4z"
        fill="#FFD93D"
      />
    </svg>
  )
}

// Streak-specific leaderboard
interface StreakCardProps {
  entries: LeaderboardEntry[]
}

export function StreakCard({ entries }: StreakCardProps) {
  // Sort entries by current streak descending
  const sortedEntries = [...entries]
    .filter(e => e.streak.current > 0)
    .sort((a, b) => b.streak.current - a.streak.current)

  return (
    <div className="rounded-lg border border-rpg-border/50 bg-rpg-bg/50">
      {/* Header */}
      <div className="px-3 py-2 border-b border-rpg-border/30 flex items-center gap-2">
        <FireIcon />
        <h3 className="text-sm font-medium text-rpg-text">Active Streaks</h3>
      </div>

      {/* Entries */}
      <div className="p-2 space-y-1">
        {sortedEntries.length === 0 ? (
          <p className="text-center text-sm text-rpg-idle/60 py-4">No active streaks</p>
        ) : (
          sortedEntries.slice(0, 5).map((entry, idx) => {
            const rank = idx + 1
            const isTopThree = rank <= 3
            return (
              <div
                key={entry.companionId}
                className={`flex items-center gap-2 px-2 py-1.5 rounded ${
                  isTopThree ? 'bg-rpg-card/50' : ''
                }`}
              >
                {/* Rank badge - trophy for top 3 */}
                <span
                  className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded border ${getRankClass(rank)}`}
                >
                  {isTopThree ? <TrophyIcon rank={rank} /> : rank}
                </span>

                {/* Name */}
                <span className="flex-1 text-sm truncate text-rpg-text/90">
                  {entry.companionName}
                </span>

                {/* Current streak with fire */}
                <span className="flex items-center gap-1 text-sm font-mono text-rpg-waiting tabular-nums">
                  <FireIcon />
                  {entry.streak.current}
                </span>
                <span className="text-xs text-rpg-idle/60 w-10">
                  days
                </span>

                {/* Longest streak badge */}
                {entry.streak.longest > entry.streak.current && (
                  <span className="text-xs text-rpg-idle/40" title="Best streak">
                    (best: {entry.streak.longest})
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
