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
// Batched Database Queries for Period Filtering
// ═══════════════════════════════════════════════════════════════════════════

interface BatchedStats {
  xp: Map<string, number>
  commits: Map<string, number>
  tests: Map<string, number>
  tools: Map<string, number>
  prompts: Map<string, number>
  quests: Map<string, number>
}

/**
 * Batch query all stats for a time period in a single pass.
 * Returns maps of projectId -> value for each category.
 */
function getBatchedStatsForPeriod(startDate: string): BatchedStats {
  const db = getDatabase()

  // XP totals by project
  const xpResults = db.prepare<{ project_id: string; total: number }, [string]>(
    'SELECT project_id, COALESCE(SUM(xp_amount), 0) as total FROM xp_events WHERE created_at >= ? GROUP BY project_id'
  ).all(startDate)
  const xp = new Map(xpResults.map(r => [r.project_id, r.total]))

  // Event counts by project and type
  const eventResults = db.prepare<{ project_id: string; event_type: string; count: number }, [string]>(
    'SELECT project_id, event_type, COUNT(*) as count FROM xp_events WHERE created_at >= ? GROUP BY project_id, event_type'
  ).all(startDate)

  const commits = new Map<string, number>()
  const tests = new Map<string, number>()
  const tools = new Map<string, number>()
  const prompts = new Map<string, number>()
  const quests = new Map<string, number>()

  for (const row of eventResults) {
    const { project_id, event_type, count } = row
    if (event_type === 'commit') {
      commits.set(project_id, (commits.get(project_id) ?? 0) + count)
    } else if (event_type === 'test_run') {
      tests.set(project_id, (tests.get(project_id) ?? 0) + count)
    } else if (event_type.startsWith('tool:')) {
      tools.set(project_id, (tools.get(project_id) ?? 0) + count)
    } else if (event_type === 'prompt') {
      prompts.set(project_id, (prompts.get(project_id) ?? 0) + count)
    } else if (event_type === 'quest_completed') {
      quests.set(project_id, (quests.get(project_id) ?? 0) + count)
    }
  }

  return { xp, commits, tests, tools, prompts, quests }
}

// Cache for batched stats (short TTL to avoid stale data)
let statsCache: { startDate: string; stats: BatchedStats; timestamp: number } | null = null
const CACHE_TTL_MS = 5000 // 5 seconds

function getCachedBatchedStats(startDate: string): BatchedStats {
  const now = Date.now()
  if (statsCache && statsCache.startDate === startDate && now - statsCache.timestamp < CACHE_TTL_MS) {
    return statsCache.stats
  }
  const stats = getBatchedStatsForPeriod(startDate)
  statsCache = { startDate, stats, timestamp: now }
  return stats
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

/**
 * Helper to ensure exhaustive switch handling at compile time.
 * If a new category is added, TypeScript will error here.
 */
function assertNever(x: never): never {
  throw new Error(`Unexpected category: ${x}`)
}

function getCategoryValue(
  companion: Companion,
  category: CompetitionCategory,
  period: TimePeriod,
  batchedStats?: BatchedStats
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
        return assertNever(category)
    }
  }

  // For 'today' and 'week' periods, use batched stats (pre-fetched in single query)
  const stats = batchedStats ?? getCachedBatchedStats(startDate)
  switch (category) {
    case 'xp':
      return stats.xp.get(companion.id) ?? 0
    case 'commits':
      return stats.commits.get(companion.id) ?? 0
    case 'tests':
      return stats.tests.get(companion.id) ?? 0
    case 'tools':
      return stats.tools.get(companion.id) ?? 0
    case 'prompts':
      return stats.prompts.get(companion.id) ?? 0
    case 'quests':
      return stats.quests.get(companion.id) ?? 0
    default:
      return assertNever(category)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Leaderboard Calculation
// ═══════════════════════════════════════════════════════════════════════════

function calculateLeaderboard(
  companions: Companion[],
  category: CompetitionCategory,
  period: TimePeriod,
  batchedStats?: BatchedStats
): LeaderboardEntry[] {
  // Calculate values for each companion with validated streaks
  const entries = companions.map(companion => ({
    companionId: companion.id,
    companionName: companion.name,
    value: getCategoryValue(companion, category, period, batchedStats),
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
 * Pre-fetches batched stats for today/week periods to minimize DB queries.
 */
export function getAllCompetitions(): Competition[] {
  const companions = getAllCompanions()
  const categories: CompetitionCategory[] = ['xp', 'commits', 'tests', 'tools', 'prompts', 'quests']
  const periods: TimePeriod[] = ['today', 'week', 'all']
  const now = Date.now()

  // Pre-fetch batched stats for today and week periods (2 queries total instead of N*12)
  const todayStats = getCachedBatchedStats(getStartOfDayUTC())
  const weekStats = getCachedBatchedStats(getStartOfWeekUTC())

  const competitions: Competition[] = []

  for (const category of categories) {
    for (const period of periods) {
      // Pass pre-fetched stats for today/week periods
      const batchedStats = period === 'today' ? todayStats : period === 'week' ? weekStats : undefined
      competitions.push({
        category,
        period,
        entries: calculateLeaderboard(companions, category, period, batchedStats),
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
  const startDate = getDateRangeForPeriod(period)
  const batchedStats = startDate ? getCachedBatchedStats(startDate) : undefined
  return {
    category,
    period,
    entries: calculateLeaderboard(companions, category, period, batchedStats),
    updatedAt: Date.now(),
  }
}
