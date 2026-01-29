/**
 * Achievement definitions
 */

import type { AchievementDefinition, EntityStats } from './types'

/**
 * All achievement definitions
 */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Getting Started
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Use your first tool',
    icon: '🎯',
    category: 'getting_started',
    rarity: 'common',
    scope: 'persona',
    check: (stats: EntityStats) => stats.toolsUsed >= 1,
  },
  {
    id: 'hello_world',
    name: 'Hello World',
    description: 'Write your first file',
    icon: '👋',
    category: 'getting_started',
    rarity: 'common',
    scope: 'project',
    check: (stats: EntityStats) => stats.filesWritten >= 1,
  },
  {
    id: 'tool_time',
    name: 'Tool Time',
    description: 'Use 10 different tools',
    icon: '🛠️',
    category: 'getting_started',
    rarity: 'uncommon',
    scope: 'persona',
    check: (stats: EntityStats) => stats.toolsUsed >= 10,
  },
  {
    id: 'getting_started',
    name: 'Getting Started',
    description: 'Reach level 5',
    icon: '⭐',
    category: 'getting_started',
    rarity: 'common',
    scope: 'persona',
    check: (stats: EntityStats) => stats.level >= 5,
  },

  // Git
  {
    id: 'committer',
    name: 'Committer',
    description: 'Create 10 commits',
    icon: '📝',
    category: 'git',
    rarity: 'common',
    scope: 'project',
    check: (stats: EntityStats) => stats.commitsCreated >= 10,
  },
  {
    id: 'century',
    name: 'Century',
    description: 'Create 100 commits',
    icon: '💯',
    category: 'git',
    rarity: 'rare',
    scope: 'project',
    check: (stats: EntityStats) => stats.commitsCreated >= 100,
  },
  {
    id: 'pr_creator',
    name: 'PR Creator',
    description: 'Create your first PR',
    icon: '📮',
    category: 'git',
    rarity: 'common',
    scope: 'persona',
    check: (stats: EntityStats) => stats.prsCreated >= 1,
  },
  {
    id: 'pr_champion',
    name: 'PR Champion',
    description: 'Get 10 PRs merged',
    icon: '🏆',
    category: 'git',
    rarity: 'rare',
    scope: 'persona',
    check: (stats: EntityStats) => stats.prsMerged >= 10,
  },

  // Testing
  {
    id: 'test_pilot',
    name: 'Test Pilot',
    description: 'Run your first test',
    icon: '🧪',
    category: 'testing',
    rarity: 'common',
    scope: 'project',
    check: (stats: EntityStats) => stats.testsRun >= 1,
  },
  {
    id: 'test_warrior',
    name: 'Test Warrior',
    description: 'Run 100 tests',
    icon: '⚔️',
    category: 'testing',
    rarity: 'uncommon',
    scope: 'project',
    check: (stats: EntityStats) => stats.testsRun >= 100,
  },
  {
    id: 'quality_guardian',
    name: 'Quality Guardian',
    description: 'Run 1000 tests',
    icon: '🛡️',
    category: 'testing',
    rarity: 'epic',
    scope: 'persona',
    check: (stats: EntityStats) => stats.testsRun >= 1000,
  },

  // Quests
  {
    id: 'adventurer',
    name: 'Adventurer',
    description: 'Complete 5 quests',
    icon: '🗺️',
    category: 'quests',
    rarity: 'uncommon',
    scope: 'persona',
    check: (stats: EntityStats) => stats.questsCompleted >= 5,
  },
  {
    id: 'hero',
    name: 'Hero',
    description: 'Complete 25 quests',
    icon: '🦸',
    category: 'quests',
    rarity: 'rare',
    scope: 'persona',
    check: (stats: EntityStats) => stats.questsCompleted >= 25,
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Complete 100 quests',
    icon: '👑',
    category: 'quests',
    rarity: 'legendary',
    scope: 'persona',
    check: (stats: EntityStats) => stats.questsCompleted >= 100,
  },

  // Streaks
  {
    id: 'consistent',
    name: 'Consistent',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    category: 'streaks',
    rarity: 'common',
    scope: 'persona',
    check: (stats: EntityStats) => stats.currentStreak >= 3,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Maintain a 7-day streak',
    icon: '💪',
    category: 'streaks',
    rarity: 'uncommon',
    scope: 'persona',
    check: (stats: EntityStats) => stats.currentStreak >= 7,
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Maintain a 30-day streak',
    icon: '⚡',
    category: 'streaks',
    rarity: 'epic',
    scope: 'persona',
    check: (stats: EntityStats) => stats.longestStreak >= 30,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Maintain a 100-day streak',
    icon: '🌟',
    category: 'streaks',
    rarity: 'legendary',
    scope: 'persona',
    check: (stats: EntityStats) => stats.longestStreak >= 100,
  },

  // Milestones
  {
    id: 'rising_star',
    name: 'Rising Star',
    description: 'Earn 1,000 XP',
    icon: '✨',
    category: 'milestones',
    rarity: 'uncommon',
    scope: 'persona',
    check: (stats: EntityStats) => stats.totalXp >= 1000,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Earn 10,000 XP',
    icon: '🎖️',
    category: 'milestones',
    rarity: 'rare',
    scope: 'persona',
    check: (stats: EntityStats) => stats.totalXp >= 10000,
  },
  {
    id: 'xp_legend',
    name: 'XP Legend',
    description: 'Earn 100,000 XP',
    icon: '🏅',
    category: 'milestones',
    rarity: 'legendary',
    scope: 'persona',
    check: (stats: EntityStats) => stats.totalXp >= 100000,
  },

  // Blockchain
  {
    id: 'clarity_writer',
    name: 'Clarity Writer',
    description: 'Edit a Clarity smart contract',
    icon: '📜',
    category: 'blockchain',
    rarity: 'uncommon',
    scope: 'project',
    check: (stats: EntityStats) => stats.clarityFilesEdited >= 1,
  },
  {
    id: 'clarity_sage',
    name: 'Clarity Sage',
    description: 'Edit 10 Clarity contracts',
    icon: '🧙',
    category: 'blockchain',
    rarity: 'rare',
    scope: 'persona',
    check: (stats: EntityStats) => stats.clarityFilesEdited >= 10,
  },
  {
    id: 'contract_deployer',
    name: 'Contract Deployer',
    description: 'Deploy a smart contract',
    icon: '🚀',
    category: 'blockchain',
    rarity: 'rare',
    scope: 'project',
    check: (stats: EntityStats) => stats.contractsDeployed >= 1,
  },
]

/**
 * Get achievement by ID
 */
export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category: string): AchievementDefinition[] {
  return ACHIEVEMENTS.filter(a => a.category === category)
}

/**
 * Get achievements by scope
 */
export function getAchievementsByScope(scope: 'persona' | 'project'): AchievementDefinition[] {
  return ACHIEVEMENTS.filter(a => a.scope === scope)
}
