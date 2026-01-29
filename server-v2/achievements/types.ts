/**
 * Achievement types
 */

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type AchievementCategory =
  | 'getting_started'
  | 'git'
  | 'testing'
  | 'quests'
  | 'streaks'
  | 'milestones'
  | 'blockchain'

export type AchievementScope = 'persona' | 'project' | 'global'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  rarity: AchievementRarity
  scope: AchievementScope
  check: (stats: EntityStats) => boolean
}

export interface UnlockedAchievement {
  id: number
  entityType: 'persona' | 'project'
  entityId: string
  achievementId: string
  unlockedAt: string
}

export interface EntityStats {
  totalXp: number
  level: number
  toolsUsed: number
  filesEdited: number
  filesWritten: number
  commitsCreated: number
  pushes: number
  prsCreated: number
  prsMerged: number
  testsRun: number
  questsCompleted: number
  currentStreak: number
  longestStreak: number
  contractsDeployed: number
  clarityFilesEdited: number
}
