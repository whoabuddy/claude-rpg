/**
 * Companion service - aggregates Project + Stats + Streak + Achievements
 * into the full Companion type expected by the client
 */

import { createLogger } from '../lib/logger'
import { queries, getDatabase } from '../db'
import { transaction } from '../db/queries'
import { getAllProjects, getProjectById } from '../projects/service'
import type { Companion, CompanionStats, StreakInfo, Achievement, RepoInfo } from '../../shared/types'

const log = createLogger('companion-service')

// Default stats structure
const DEFAULT_STATS: CompanionStats = {
  toolsUsed: {},
  promptsReceived: 0,
  sessionsCompleted: 0,
  git: { commits: 0, pushes: 0, prsCreated: 0, prsMerged: 0 },
  commands: { testsRun: 0, buildsRun: 0, deploysRun: 0, lintsRun: 0 },
  blockchain: { clarinetChecks: 0, clarinetTests: 0, testnetDeploys: 0, mainnetDeploys: 0 },
  quests: { created: 0, phasesCompleted: 0, questsCompleted: 0, totalRetries: 0 },
}

// Default streak structure
const DEFAULT_STREAK: StreakInfo = {
  current: 0,
  longest: 0,
  lastActivityDate: null,
}

/**
 * Get all companions (projects with full stats)
 */
export function getAllCompanions(): Companion[] {
  const projects = getAllProjects()
  return projects.map(projectToCompanion)
}

/**
 * Get companion by ID
 */
export function getCompanionById(id: string): Companion | null {
  const project = getProjectById(id)
  if (!project) return null
  return projectToCompanion(project)
}

/**
 * Get companion by repo path
 */
export function getCompanionByPath(path: string): Companion | null {
  const result = queries.getProjectByPath.get(path) as Record<string, unknown> | null
  if (!result) return null
  return projectToCompanion(mapDbToProject(result))
}

/**
 * Convert a project to a companion with full stats
 */
function projectToCompanion(project: {
  id: string
  path: string
  name: string
  githubUrl: string | null
  totalXp: number
  level: number
  createdAt: string
  lastActivityAt: string
  currentStreak?: number
  longestStreak?: number
  lastStreakDate?: string | null
}): Companion {
  // Get stats from stats table
  const stats = getStatsForProject(project.id)

  // Get achievements
  const achievements = getAchievementsForProject(project.id)

  // Build streak info
  const streak: StreakInfo = {
    current: project.currentStreak || 0,
    longest: project.longestStreak || 0,
    lastActiveDate: project.lastStreakDate || new Date().toISOString().split('T')[0],
  }

  // Build repo info
  const repo: RepoInfo = {
    path: project.path,
    name: project.name,
  }

  // Extract org from GitHub URL if available
  if (project.githubUrl) {
    const match = project.githubUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
    if (match) {
      repo.org = match[1]
      repo.remote = `git@github.com:${match[1]}/${match[2]}.git`
    }
  }

  return {
    id: project.id,
    name: project.name,
    repo,
    level: project.level,
    experience: 0, // Current level XP - would need calculation
    totalExperience: project.totalXp,
    stats,
    streak,
    achievements,
    createdAt: new Date(project.createdAt).getTime(),
    lastActivity: new Date(project.lastActivityAt).getTime(),
  }
}

/**
 * Get stats for a project from the stats table
 */
function getStatsForProject(projectId: string): CompanionStats {
  const rows = queries.getStatsByEntity.all('project', projectId) as Array<{ stat_path: string; value: number }>

  const stats: CompanionStats = { ...DEFAULT_STATS }

  for (const row of rows) {
    const path = row.stat_path.split('.')
    let current: Record<string, unknown> = stats as unknown as Record<string, unknown>

    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {}
      }
      current = current[path[i]] as Record<string, unknown>
    }

    const key = path[path.length - 1]
    if (path[0] === 'toolsUsed') {
      // toolsUsed is a special case - key is the tool name
      (stats.toolsUsed as Record<string, number>)[key] = row.value
    } else {
      current[key] = row.value
    }
  }

  return stats
}

/**
 * Get achievements for a project
 */
function getAchievementsForProject(projectId: string): Achievement[] {
  const rows = queries.getAchievementsByEntity.all('project', projectId) as Array<{
    achievement_id: string
    unlocked_at: string
  }>

  return rows.map(row => ({
    id: row.achievement_id,
    name: getAchievementName(row.achievement_id),
    description: getAchievementDescription(row.achievement_id),
    rarity: getAchievementRarity(row.achievement_id),
    unlockedAt: new Date(row.unlocked_at).getTime(),
  }))
}

/**
 * Increment a stat for a project
 */
export function incrementStat(projectId: string, statPath: string, amount: number = 1): void {
  queries.upsertStat.run('project', projectId, statPath, amount)
  log.debug('Incremented stat', { projectId, statPath, amount })
}

/**
 * Update streak for a project (atomic transaction to prevent race conditions)
 */
export function updateStreak(projectId: string): void {
  const db = getDatabase()

  transaction(db, () => {
    const project = db.query('SELECT current_streak, longest_streak, last_streak_date FROM projects WHERE id = ?').get(projectId) as {
      current_streak: number | null
      longest_streak: number | null
      last_streak_date: string | null
    } | null

    if (!project) return

    const today = new Date().toISOString().split('T')[0]
    const lastDate = project.last_streak_date

    let newStreak = project.current_streak || 0
    let longestStreak = project.longest_streak || 0

    if (!lastDate) {
      // First activity
      newStreak = 1
    } else if (lastDate === today) {
      // Already updated today, no change
      return
    } else {
      const lastDateObj = new Date(lastDate)
      const todayObj = new Date(today)
      const diffDays = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // Consecutive day - increment streak
        newStreak += 1
      } else {
        // Streak broken - reset to 1
        newStreak = 1
      }
    }

    // Update longest streak if current is higher
    if (newStreak > longestStreak) {
      longestStreak = newStreak
    }

    queries.updateProjectStreak.run(newStreak, longestStreak, today, projectId)
    log.debug('Updated streak', { projectId, newStreak, longestStreak })
  })
}

/**
 * Map database row to project object with streak fields
 */
function mapDbToProject(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    path: row.path as string,
    name: row.name as string,
    githubUrl: row.github_url as string | null,
    totalXp: row.total_xp as number,
    level: row.level as number,
    createdAt: row.created_at as string,
    lastActivityAt: row.last_activity_at as string,
    currentStreak: row.current_streak as number | undefined,
    longestStreak: row.longest_streak as number | undefined,
    lastStreakDate: row.last_streak_date as string | null | undefined,
  }
}

// Achievement metadata helpers
function getAchievementName(id: string): string {
  const names: Record<string, string> = {
    first_commit: 'First Commit',
    ten_commits: 'Committed',
    hundred_commits: 'Committer',
    first_pr: 'Pull Request Pioneer',
    merged_pr: 'Merger',
    first_test: 'Test Runner',
    streak_7: 'Week Warrior',
    streak_30: 'Monthly Master',
    level_5: 'Leveling Up',
    level_10: 'Veteran',
  }
  return names[id] || id
}

function getAchievementDescription(id: string): string {
  const descriptions: Record<string, string> = {
    first_commit: 'Made your first commit',
    ten_commits: 'Made 10 commits',
    hundred_commits: 'Made 100 commits',
    first_pr: 'Created your first pull request',
    merged_pr: 'Merged a pull request',
    first_test: 'Ran tests for the first time',
    streak_7: 'Maintained a 7-day streak',
    streak_30: 'Maintained a 30-day streak',
    level_5: 'Reached level 5',
    level_10: 'Reached level 10',
  }
  return descriptions[id] || ''
}

function getAchievementRarity(id: string): 'common' | 'rare' | 'epic' | 'legendary' {
  const rarities: Record<string, 'common' | 'rare' | 'epic' | 'legendary'> = {
    first_commit: 'common',
    ten_commits: 'common',
    hundred_commits: 'rare',
    first_pr: 'common',
    merged_pr: 'common',
    first_test: 'common',
    streak_7: 'rare',
    streak_30: 'epic',
    level_5: 'rare',
    level_10: 'epic',
  }
  return rarities[id] || 'common'
}
