/**
 * Competitions module - calculate leaderboards from database stats
 */

import { getAllCompanions } from '../companions'
import type {
  Competition,
  CompetitionCategory,
  TimePeriod,
  LeaderboardEntry,
  Companion,
  StreakInfo,
} from '../../shared/types'

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10) // YYYY-MM-DD
}

function isConsecutiveDay(date1: string, date2: string): boolean {
  const [y1, m1, d1] = date1.split('-').map(Number)
  const [y2, m2, d2] = date2.split('-').map(Number)

  const day1 = new Date(y1, m1 - 1, d1, 12, 0, 0)
  const day2 = new Date(y2, m2 - 1, d2, 12, 0, 0)

  const diffMs = Math.abs(day2.getTime() - day1.getTime())
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))

  return diffDays === 1
}

function isStreakActive(streak: StreakInfo): boolean {
  if (!streak.lastActiveDate || streak.current === 0) return false

  const today = formatDate(Date.now())
  const yesterday = formatDate(Date.now() - 24 * 60 * 60 * 1000)

  return streak.lastActiveDate === today || streak.lastActiveDate === yesterday
}

function getValidatedStreak(streak: StreakInfo): StreakInfo {
  if (!isStreakActive(streak)) {
    return {
      ...streak,
      current: 0, // Reset current but keep longest for history
    }
  }
  return streak
}

// ═══════════════════════════════════════════════════════════════════════════
// Category Value Extraction
// ═══════════════════════════════════════════════════════════════════════════

function getCategoryValue(
  companion: Companion,
  category: CompetitionCategory,
  _period: TimePeriod
): number {
  // NOTE: For now, all periods use all-time stats
  // TODO: Implement period filtering by querying xp_events table with date ranges

  switch (category) {
    case 'xp':
      return companion.totalExperience

    case 'commits':
      return companion.stats.git.commits

    case 'tests':
      return companion.stats.commands.testsRun

    case 'tools':
      return Object.values(companion.stats.toolsUsed).reduce((a, b) => a + b, 0)

    case 'prompts':
      return companion.stats.promptsReceived

    case 'quests':
      return companion.stats.quests?.questsCompleted ?? 0

    default:
      return 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Leaderboard Calculation
// ═══════════════════════════════════════════════════════════════════════════

function calculateLeaderboard(
  companions: Companion[],
  category: CompetitionCategory,
  period: TimePeriod
): LeaderboardEntry[] {
  // Calculate values for each companion with validated streaks
  const entries = companions.map(companion => ({
    companionId: companion.id,
    companionName: companion.name,
    value: getCategoryValue(companion, category, period),
    streak: getValidatedStreak(companion.streak),
  }))

  // Sort by value descending
  entries.sort((a, b) => b.value - a.value)

  // Add ranks
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}

/**
 * Get all competitions (all categories, all periods)
 */
export function getAllCompetitions(): Competition[] {
  const companions = getAllCompanions()
  const categories: CompetitionCategory[] = ['xp', 'commits', 'tests', 'tools', 'prompts', 'quests']
  const periods: TimePeriod[] = ['today', 'week', 'all']
  const now = Date.now()

  const competitions: Competition[] = []

  for (const category of categories) {
    for (const period of periods) {
      competitions.push({
        category,
        period,
        entries: calculateLeaderboard(companions, category, period),
        updatedAt: now,
      })
    }
  }

  return competitions
}

/**
 * Get a specific competition
 */
export function getCompetition(
  category: CompetitionCategory,
  period: TimePeriod = 'all'
): Competition {
  const companions = getAllCompanions()
  return {
    category,
    period,
    entries: calculateLeaderboard(companions, category, period),
    updatedAt: Date.now(),
  }
}
