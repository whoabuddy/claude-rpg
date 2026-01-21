import type {
  Companion,
  ClaudeEvent,
  Competition,
  CompetitionCategory,
  TimePeriod,
  LeaderboardEntry,
  StreakInfo,
} from '../shared/types.js'

// ═══════════════════════════════════════════════════════════════════════════
// Date Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10) // YYYY-MM-DD
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfWeek(date: Date): Date {
  const d = getStartOfDay(date)
  const day = d.getDay()
  // Start week on Monday
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d
}

function isConsecutiveDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diff = Math.abs(d1.getTime() - d2.getTime())
  const oneDay = 24 * 60 * 60 * 1000
  return diff <= oneDay && diff > 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Streak Tracking
// ═══════════════════════════════════════════════════════════════════════════

export function createDefaultStreak(): StreakInfo {
  return {
    current: 0,
    longest: 0,
    lastActiveDate: '',
  }
}

export function updateStreak(streak: StreakInfo, activityDate: string): StreakInfo {
  const today = formatDate(Date.now())

  // No previous activity
  if (!streak.lastActiveDate) {
    return {
      current: 1,
      longest: Math.max(streak.longest, 1),
      lastActiveDate: activityDate,
    }
  }

  // Same day - no change
  if (streak.lastActiveDate === activityDate) {
    return streak
  }

  // Check if consecutive
  if (isConsecutiveDay(streak.lastActiveDate, activityDate)) {
    const newCurrent = streak.current + 1
    return {
      current: newCurrent,
      longest: Math.max(streak.longest, newCurrent),
      lastActiveDate: activityDate,
    }
  }

  // Streak broken - reset to 1
  return {
    current: 1,
    longest: streak.longest,
    lastActiveDate: activityDate,
  }
}

// Check if streak is still active (activity today or yesterday)
export function isStreakActive(streak: StreakInfo): boolean {
  if (!streak.lastActiveDate || streak.current === 0) return false

  const today = formatDate(Date.now())
  const yesterday = formatDate(Date.now() - 24 * 60 * 60 * 1000)

  return streak.lastActiveDate === today || streak.lastActiveDate === yesterday
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Filtering
// ═══════════════════════════════════════════════════════════════════════════

export function filterEventsByPeriod(events: ClaudeEvent[], period: TimePeriod): ClaudeEvent[] {
  if (period === 'all') return events

  const now = new Date()
  let cutoff: Date

  if (period === 'today') {
    cutoff = getStartOfDay(now)
  } else {
    // 'week'
    cutoff = getStartOfWeek(now)
  }

  const cutoffTime = cutoff.getTime()
  return events.filter(e => e.timestamp >= cutoffTime)
}

export function filterEventsByCompanion(events: ClaudeEvent[], companion: Companion): ClaudeEvent[] {
  return events.filter(e => e.cwd.startsWith(companion.repo.path))
}

// ═══════════════════════════════════════════════════════════════════════════
// Category Value Extraction
// ═══════════════════════════════════════════════════════════════════════════

function getCategoryValue(
  companion: Companion,
  events: ClaudeEvent[],
  category: CompetitionCategory,
  period: TimePeriod
): number {
  const periodEvents = filterEventsByPeriod(events, period)
  const companionEvents = filterEventsByCompanion(periodEvents, companion)

  switch (category) {
    case 'xp':
      // For 'all', use totalExperience; for periods, sum from events
      if (period === 'all') {
        return companion.totalExperience
      }
      // Estimate XP from events (simplified - real XP calculation in xp.ts)
      return companionEvents.filter(e => e.type === 'post_tool_use').length * 2

    case 'commits':
      if (period === 'all') {
        return companion.stats.git.commits
      }
      // Count commit events in period
      return companionEvents.filter(e => {
        if (e.type !== 'post_tool_use') return false
        const toolInput = (e as { toolInput?: { command?: string } }).toolInput
        return toolInput?.command?.includes('git commit')
      }).length

    case 'tests':
      if (period === 'all') {
        return companion.stats.commands.testsRun
      }
      // Count test events in period
      return companionEvents.filter(e => {
        if (e.type !== 'post_tool_use') return false
        const toolInput = (e as { toolInput?: { command?: string } }).toolInput
        const cmd = toolInput?.command || ''
        return cmd.includes('test') || cmd.includes('vitest') || cmd.includes('pytest')
      }).length

    case 'tools':
      if (period === 'all') {
        return Object.values(companion.stats.toolsUsed).reduce((a, b) => a + b, 0)
      }
      // Count tool uses in period
      return companionEvents.filter(e => e.type === 'post_tool_use').length

    case 'prompts':
      if (period === 'all') {
        return companion.stats.promptsReceived
      }
      // Count prompts in period
      return companionEvents.filter(e => e.type === 'user_prompt_submit').length

    default:
      return 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Leaderboard Calculation
// ═══════════════════════════════════════════════════════════════════════════

export function calculateLeaderboard(
  companions: Companion[],
  events: ClaudeEvent[],
  category: CompetitionCategory,
  period: TimePeriod
): LeaderboardEntry[] {
  // Calculate values for each companion
  const entries = companions.map(companion => ({
    companionId: companion.id,
    companionName: companion.name,
    value: getCategoryValue(companion, events, category, period),
    streak: companion.streak || createDefaultStreak(),
  }))

  // Sort by value descending
  entries.sort((a, b) => b.value - a.value)

  // Add ranks
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}

export function getAllCompetitions(
  companions: Companion[],
  events: ClaudeEvent[]
): Competition[] {
  const categories: CompetitionCategory[] = ['xp', 'commits', 'tests', 'tools', 'prompts']
  const periods: TimePeriod[] = ['today', 'week', 'all']
  const now = Date.now()

  const competitions: Competition[] = []

  for (const category of categories) {
    for (const period of periods) {
      competitions.push({
        category,
        period,
        entries: calculateLeaderboard(companions, events, category, period),
        updatedAt: now,
      })
    }
  }

  return competitions
}

export function getCompetition(
  companions: Companion[],
  events: ClaudeEvent[],
  category: CompetitionCategory,
  period: TimePeriod = 'all'
): Competition {
  return {
    category,
    period,
    entries: calculateLeaderboard(companions, events, category, period),
    updatedAt: Date.now(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Streak Leaderboard (special case - sorted by streak)
// ═══════════════════════════════════════════════════════════════════════════

export function getStreakLeaderboard(companions: Companion[]): LeaderboardEntry[] {
  const entries = companions.map(companion => ({
    companionId: companion.id,
    companionName: companion.name,
    rank: 0,
    value: companion.streak?.current || 0,
    streak: companion.streak || createDefaultStreak(),
  }))

  // Sort by current streak descending
  entries.sort((a, b) => b.value - a.value)

  // Add ranks
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}
