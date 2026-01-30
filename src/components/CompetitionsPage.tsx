import { useState } from 'react'
import type { TimePeriod, LeaderboardEntry, Achievement, CompetitionCategory } from '@shared/types'
import { ACHIEVEMENT_CATALOG, getAchievementInfo, RARITY_COLORS, RARITY_BG } from '@shared/achievement-defs'
import { useStore } from '../store'
import { useCompetitions } from '../hooks/useCompetitions'
import { LeaderboardCard, StreakCard } from './LeaderboardCard'
import { ConnectionBanner, ConnectionDot } from './ConnectionStatus'
import { PageHeader } from './PageHeader'

interface CompetitionsPageProps {
  connected: boolean
  reconnectAttempt?: number
  onRetry?: () => void
  onNavigateBack: () => void
  onNavigateToProject: (companionId: string) => void
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: 'Today',
  week: 'This Week',
  all: 'All Time',
}

const CATEGORIES: { id: CompetitionCategory; label: string; icon: string; unit: string }[] = [
  { id: 'xp', label: 'XP', icon: '⚡', unit: 'XP' },
  { id: 'commits', label: 'Commits', icon: '📝', unit: '' },
  { id: 'tests', label: 'Tests', icon: '✓', unit: '' },
  { id: 'tools', label: 'Tools', icon: '🔧', unit: '' },
  { id: 'prompts', label: 'Prompts', icon: '💬', unit: '' },
  { id: 'quests', label: 'Quests', icon: '📜', unit: '' },
]

export function CompetitionsPage({ connected, reconnectAttempt, onRetry, onNavigateBack, onNavigateToProject }: CompetitionsPageProps) {
  const [period, setPeriod] = useState<TimePeriod>('today')
  const [category, setCategory] = useState<CompetitionCategory>('xp')
  const { competitions, loading, getByCategory } = useCompetitions(period)

  // Get companions from store for achievements display
  const companions = useStore((state) => state.companions)

  // Get streak entries from XP competition (all have streak info)
  const xpCompetition = getByCategory('xp')
  const streakEntries: LeaderboardEntry[] = xpCompetition?.entries ?? []

  // Get selected competition
  const selectedCompetition = getByCategory(category)
  const selectedCategoryConfig = CATEGORIES.find(c => c.id === category)

  // Aggregate all achievements across companions (#37)
  const allAchievements = companions.flatMap(c =>
    (c.achievements || []).map(a => ({ ...a, companionName: c.name }))
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Leaderboard">
        {/* Time Period Toggle in header */}
        <div className="inline-flex rounded-lg border border-rpg-border bg-rpg-card p-0.5">
          {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-rpg-accent text-rpg-bg'
                  : 'text-rpg-text-muted hover:text-rpg-text'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">

      {/* Disconnected banner */}
      <ConnectionBanner connected={connected} reconnectAttempt={reconnectAttempt} onRetry={onRetry} />

      {/* Main content - dimmed when disconnected */}
      <div className={!connected ? 'opacity-60 pointer-events-none' : undefined}>
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-rpg-accent border-t-transparent rounded-full" />
          </div>
        )}

        {/* Category Tabs */}
        {!loading && (
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg
                          whitespace-nowrap transition-colors flex-shrink-0 ${
                  category === cat.id
                    ? 'bg-rpg-accent/15 text-rpg-accent border border-rpg-accent/30'
                    : 'text-rpg-text-muted hover:bg-rpg-card border border-transparent'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Leaderboard */}
        {!loading && (
          <div className="space-y-4">
            {selectedCompetition ? (
              <LeaderboardCard
                competition={selectedCompetition}
                title={`${selectedCategoryConfig?.icon || ''} ${selectedCategoryConfig?.label || 'Leaderboard'}`}
                unit={selectedCategoryConfig?.unit || ''}
                emptyMessage={`No ${selectedCategoryConfig?.label.toLowerCase()} data yet`}
                onSelectEntry={onNavigateToProject}
              />
            ) : (
              <p className="text-rpg-text-dim text-center py-8">
                No data for this category
              </p>
            )}

            {/* Streaks - always visible below main leaderboard (#82) */}
            <StreakCard entries={streakEntries} onSelectEntry={onNavigateToProject} />

            {/* Achievements showcase (#37) */}
            <AchievementsCard achievements={allAchievements} />
          </div>
        )}

        {/* Empty state */}
        {!loading && competitions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-rpg-text-muted">
            <p className="text-lg mb-2">No competition data yet</p>
            <p className="text-sm text-rpg-text-dim">Start using Claude Code to earn XP and climb the leaderboards!</p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// ── Achievements Card (#37) ────────────────────────────────────────────────

interface UnlockedAchievement extends Achievement {
  companionName: string
}

function AchievementsCard({ achievements }: { achievements: UnlockedAchievement[] }) {
  const [showAll, setShowAll] = useState(false)
  const unlockedIds = new Set(achievements.map(a => a.id))
  const totalUnlocked = unlockedIds.size
  const totalAvailable = ACHIEVEMENT_CATALOG.length

  return (
    <div className="rounded-lg border border-rpg-border bg-rpg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-rpg-text">
          Achievements
        </h3>
        <span className="text-xs text-rpg-text-dim">
          {totalUnlocked}/{totalAvailable}
        </span>
      </div>

      {totalUnlocked === 0 ? (
        <p className="text-xs text-rpg-text-dim py-2">
          No achievements unlocked yet. Keep using Claude Code to earn badges!
        </p>
      ) : (
        <>
          {/* Unlocked badges grid */}
          <div className="flex flex-wrap gap-2 mb-3">
            {achievements
              .sort((a, b) => b.unlockedAt - a.unlockedAt)
              .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i) // dedupe
              .map(a => {
                const def = getAchievementInfo(a.id)
                if (!def) return null
                return (
                  <div
                    key={a.id}
                    className={`px-2 py-1.5 rounded-lg ${RARITY_BG[def.rarity]} flex items-center gap-1.5`}
                    title={`${def.name}: ${def.description} (${a.companionName})`}
                  >
                    <span className="text-base">{def.icon}</span>
                    <div className="min-w-0">
                      <div className={`text-xs font-medium ${RARITY_COLORS[def.rarity]}`}>
                        {def.name}
                      </div>
                      <div className="text-[10px] text-rpg-text-dim truncate">
                        {a.companionName}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {/* Toggle locked achievements view */}
      <button
        onClick={() => setShowAll(prev => !prev)}
        className="text-xs text-rpg-accent hover:underline"
      >
        {showAll ? 'Hide locked' : `Show all ${totalAvailable} achievements`}
      </button>

      {showAll && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {ACHIEVEMENT_CATALOG.map(def => {
            const unlocked = unlockedIds.has(def.id)
            return (
              <div
                key={def.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded ${unlocked ? RARITY_BG[def.rarity] : 'bg-rpg-bg/50 opacity-50'}`}
              >
                <span className={`text-base ${unlocked ? '' : 'grayscale'}`}>{def.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-medium ${unlocked ? RARITY_COLORS[def.rarity] : 'text-rpg-text-dim'}`}>
                    {def.name}
                  </div>
                  <div className="text-[10px] text-rpg-text-dim truncate">{def.description}</div>
                </div>
                {unlocked && (
                  <span className="text-[10px] text-rpg-text-dim flex-shrink-0">
                    ✓
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
