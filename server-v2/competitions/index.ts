/**
 * Competitions module - calculate leaderboards from database stats
 */

import { getAllCompanions } from '../companions'
import { getDatabase } from '../db'
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

// ═══════════════════════════════════════════════════════════════════════════
// Date Range Helpers for Period Filtering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get start of today in UTC as ISO string
 */
function getStartOfDayUTC(): string {
  const now = new Date()
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return startOfDay.toISOString()
}

/**
 * Get start of 7 days ago in UTC as ISO string
 */
function getStartOfWeekUTC(): string {
  const now = new Date()
  const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7))
  return startOfWeek.toISOString()
}

/**
 * Get the start date for a time period, or null for 'all'
 */
function getDateRangeForPeriod(period: TimePeriod): string | null {
  switch (period) {
    case 'today':
      return getStartOfDayUTC()
    case 'week':
      return getStartOfWeekUTC()
    case 'all':
      return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Database Queries for Period Filtering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get total XP for a project within a date range
 */
function getProjectXpInRange(projectId: string, startDate: string): number {
  const db = getDatabase()
  const result = db.prepare<{ total: number | null }, [string, string]>(
    'SELECT SUM(xp_amount) as total FROM xp_events WHERE project_id = ? AND created_at >= ?'
  ).get(projectId, startDate)
  return result?.total ?? 0
}

/**
 * Count events of a specific type for a project within a date range
 */
function countEventsInRange(projectId: string, startDate: string, eventType: string): number {
  const db = getDatabase()
  const result = db.prepare<{ count: number }, [string, string, string]>(
    'SELECT COUNT(*) as count FROM xp_events WHERE project_id = ? AND created_at >= ? AND event_type = ?'
  ).get(projectId, startDate, eventType)
  return result?.count ?? 0
}

/**
 * Count tool events for a project within a date range (event_type starts with 'tool:')
 */
function countToolEventsInRange(projectId: string, startDate: string): number {
  const db = getDatabase()
  const result = db.prepare<{ count: number }, [string, string]>(
    "SELECT COUNT(*) as count FROM xp_events WHERE project_id = ? AND created_at >= ? AND event_type LIKE 'tool:%'"
  ).get(projectId, startDate)
  return result?.count ?? 0
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
  period: TimePeriod
): number {
  const startDate = getDateRangeForPeriod(period)

  // For 'all' period, use cached stats from companion object
  if (!startDate) {
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

  // For 'today' and 'week' periods, query xp_events table with date range
  switch (category) {
    case 'xp':
      return getProjectXpInRange(companion.id, startDate)
    case 'commits':
      return countEventsInRange(companion.id, startDate, 'commit')
    case 'tests':
      return countEventsInRange(companion.id, startDate, 'test_run')
    case 'tools':
      return countToolEventsInRange(companion.id, startDate)
    case 'prompts':
      return countEventsInRange(companion.id, startDate, 'prompt')
    case 'quests':
      return countEventsInRange(companion.id, startDate, 'quest_completed')
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
