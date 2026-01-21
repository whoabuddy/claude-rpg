import { useState } from 'react'
import type { TimePeriod, LeaderboardEntry } from '@shared/types'
import { useCompetitions } from '../hooks/useCompetitions'
import { LeaderboardCard, StreakCard } from './LeaderboardCard'
import { ConnectionStatus } from './ConnectionStatus'

interface CompetitionsPageProps {
  connected: boolean
  onNavigateBack: () => void
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: 'Today',
  week: 'This Week',
  all: 'All Time',
}

const CATEGORY_CONFIG = {
  xp: { title: 'XP Leaders', unit: 'XP' },
  commits: { title: 'Commit Champions', unit: '' },
  tests: { title: 'Test Warriors', unit: '' },
  tools: { title: 'Tool Masters', unit: '' },
  prompts: { title: 'Prompt Pioneers', unit: '' },
}

export function CompetitionsPage({ connected, onNavigateBack }: CompetitionsPageProps) {
  const [period, setPeriod] = useState<TimePeriod>('all')
  const { competitions, loading, getByCategory } = useCompetitions(period)

  // Get streak entries from XP competition (all have streak info)
  const xpCompetition = getByCategory('xp')
  const streakEntries: LeaderboardEntry[] = xpCompetition?.entries ?? []

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="p-2 -ml-2 text-rpg-text-muted hover:text-rpg-text transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium text-rpg-text">Competitions</h1>
        </div>
        <ConnectionStatus connected={connected} />
      </div>

      {/* Time Period Selector */}
      <div className="flex gap-1 p-1 bg-rpg-card rounded-lg">
        {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
              period === p
                ? 'bg-rpg-accent text-rpg-bg font-medium'
                : 'text-rpg-text-muted hover:text-rpg-text'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-rpg-accent border-t-transparent rounded-full" />
        </div>
      )}

      {/* Leaderboards */}
      {!loading && (
        <div className="space-y-4">
          {/* XP Leaders - always show first */}
          <LeaderboardCard
            competition={getByCategory('xp')}
            title={CATEGORY_CONFIG.xp.title}
            unit={CATEGORY_CONFIG.xp.unit}
            emptyMessage="No XP earned yet"
          />

          {/* Streaks - only show for "all time" */}
          {period === 'all' && (
            <StreakCard entries={streakEntries} />
          )}

          {/* Git Activity */}
          <LeaderboardCard
            competition={getByCategory('commits')}
            title={CATEGORY_CONFIG.commits.title}
            unit={CATEGORY_CONFIG.commits.unit}
            emptyMessage="No commits yet"
          />

          {/* Tests */}
          <LeaderboardCard
            competition={getByCategory('tests')}
            title={CATEGORY_CONFIG.tests.title}
            unit={CATEGORY_CONFIG.tests.unit}
            emptyMessage="No tests run yet"
          />

          {/* Tools */}
          <LeaderboardCard
            competition={getByCategory('tools')}
            title={CATEGORY_CONFIG.tools.title}
            unit={CATEGORY_CONFIG.tools.unit}
            emptyMessage="No tools used yet"
          />

          {/* Prompts */}
          <LeaderboardCard
            competition={getByCategory('prompts')}
            title={CATEGORY_CONFIG.prompts.title}
            unit={CATEGORY_CONFIG.prompts.unit}
            emptyMessage="No prompts sent yet"
          />
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
  )
}
