/**
 * Achievement checker
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import { ACHIEVEMENTS } from './definitions'
import type { AchievementDefinition, EntityStats } from './types'

const log = createLogger('achievement-checker')

/**
 * Check achievements for an entity and return newly unlocked ones
 */
export function checkAchievements(
  entityType: 'persona' | 'project',
  entityId: string,
  stats: EntityStats
): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = []

  // Get applicable achievements for this entity type
  const applicableAchievements = ACHIEVEMENTS.filter(
    a => a.scope === entityType || a.scope === 'global'
  )

  for (const achievement of applicableAchievements) {
    // Check if already unlocked
    if (isUnlocked(entityType, entityId, achievement.id)) {
      continue
    }

    // Check if criteria met
    if (achievement.check(stats)) {
      unlocked.push(achievement)
      log.info('Achievement unlocked', {
        entityType,
        entityId,
        achievementId: achievement.id,
        name: achievement.name,
        rarity: achievement.rarity,
      })
    }
  }

  return unlocked
}

/**
 * Check if an achievement is already unlocked
 */
export function isUnlocked(
  entityType: 'persona' | 'project',
  entityId: string,
  achievementId: string
): boolean {
  const result = queries.achievementExists.get(entityType, entityId, achievementId) as { count: number }
  return result?.count > 0
}

/**
 * Unlock an achievement
 */
export function unlockAchievement(
  entityType: 'persona' | 'project',
  entityId: string,
  achievementId: string
): void {
  const now = new Date().toISOString()

  // INSERT OR IGNORE to prevent duplicates
  queries.insertAchievement.run(entityType, entityId, achievementId, now)
}

/**
 * Get unlocked achievements for an entity
 */
export function getUnlockedAchievements(
  entityType: 'persona' | 'project',
  entityId: string
): Array<{ achievementId: string; unlockedAt: string }> {
  const rows = queries.getAchievementsByEntity.all(entityType, entityId) as Array<Record<string, unknown>>

  return rows.map(row => ({
    achievementId: row.achievement_id as string,
    unlockedAt: row.unlocked_at as string,
  }))
}

/**
 * Get recent achievement unlocks
 */
export function getRecentUnlocks(limit: number = 10): Array<{
  entityType: 'persona' | 'project'
  entityId: string
  achievementId: string
  unlockedAt: string
}> {
  const rows = queries.getRecentAchievements.all(limit) as Array<Record<string, unknown>>

  return rows.map(row => ({
    entityType: row.entity_type as 'persona' | 'project',
    entityId: row.entity_id as string,
    achievementId: row.achievement_id as string,
    unlockedAt: row.unlocked_at as string,
  }))
}

/**
 * Build entity stats from database
 */
export function buildEntityStats(
  entityType: 'persona' | 'project',
  entityId: string,
  baseStats: { totalXp: number; level: number }
): EntityStats {
  const stats: EntityStats = {
    totalXp: baseStats.totalXp,
    level: baseStats.level,
    toolsUsed: 0,
    filesEdited: 0,
    filesWritten: 0,
    commitsCreated: 0,
    pushes: 0,
    prsCreated: 0,
    prsMerged: 0,
    testsRun: 0,
    questsCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    contractsDeployed: 0,
    clarityFilesEdited: 0,
  }

  // Get stats from database
  const dbStats = queries.getStatsByEntity.all(entityType, entityId) as Array<Record<string, unknown>>

  for (const row of dbStats) {
    const path = row.stat_path as string
    const value = row.value as number

    switch (path) {
      case 'tools_used': stats.toolsUsed = value; break
      case 'files_edited': stats.filesEdited = value; break
      case 'files_written': stats.filesWritten = value; break
      case 'commits_created': stats.commitsCreated = value; break
      case 'pushes': stats.pushes = value; break
      case 'prs_created': stats.prsCreated = value; break
      case 'prs_merged': stats.prsMerged = value; break
      case 'tests_run': stats.testsRun = value; break
      case 'quests_completed': stats.questsCompleted = value; break
      case 'current_streak': stats.currentStreak = value; break
      case 'longest_streak': stats.longestStreak = value; break
      case 'contracts_deployed': stats.contractsDeployed = value; break
      case 'clarity_files_edited': stats.clarityFilesEdited = value; break
    }
  }

  return stats
}
