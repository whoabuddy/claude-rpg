import type { AchievementCategory, AchievementRarity } from './types.js'

/** Client-side achievement definition (no check function) */
export interface AchievementInfo {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  rarity: AchievementRarity
}

export const ACHIEVEMENT_CATALOG: AchievementInfo[] = [
  // Getting Started
  { id: 'first_blood', name: 'First Blood', description: 'Make your first commit', icon: '🗡️', category: 'getting_started', rarity: 'common' },
  { id: 'hello_world', name: 'Hello World', description: 'Send your first prompt', icon: '👋', category: 'getting_started', rarity: 'common' },
  { id: 'tool_time', name: 'Tool Time', description: 'Use 10 different tools', icon: '🔧', category: 'getting_started', rarity: 'common' },
  // Git
  { id: 'committer', name: 'Committer', description: 'Make 10 commits', icon: '📝', category: 'git', rarity: 'common' },
  { id: 'century', name: 'Century', description: 'Make 100 commits', icon: '💯', category: 'git', rarity: 'rare' },
  { id: 'pr_champion', name: 'PR Champion', description: 'Create 10 pull requests', icon: '🏅', category: 'git', rarity: 'rare' },
  { id: 'merger', name: 'Merger', description: 'Merge 5 pull requests', icon: '🔀', category: 'git', rarity: 'rare' },
  { id: 'pusher', name: 'Pusher', description: 'Push 50 times', icon: '🚀', category: 'git', rarity: 'rare' },
  // Testing
  { id: 'test_pilot', name: 'Test Pilot', description: 'Run your first test', icon: '🧪', category: 'testing', rarity: 'common' },
  { id: 'test_warrior', name: 'Test Warrior', description: 'Run 100 tests', icon: '⚔️', category: 'testing', rarity: 'rare' },
  { id: 'quality_guardian', name: 'Quality Guardian', description: 'Run 1000 tests', icon: '🛡️', category: 'testing', rarity: 'epic' },
  // Deploy
  { id: 'ship_it', name: 'Ship It', description: 'Run your first deploy', icon: '📦', category: 'deploy', rarity: 'common' },
  { id: 'testnet_pioneer', name: 'Testnet Pioneer', description: 'Deploy to testnet', icon: '🌐', category: 'blockchain', rarity: 'rare' },
  { id: 'mainnet_hero', name: 'Mainnet Hero', description: 'Deploy to mainnet', icon: '⛓️', category: 'blockchain', rarity: 'epic' },
  { id: 'clarity_sage', name: 'Clarity Sage', description: 'Run 50 Clarinet checks', icon: '📜', category: 'blockchain', rarity: 'rare' },
  // Streaks
  { id: 'consistent', name: 'Consistent', description: '3-day activity streak', icon: '🔥', category: 'streak', rarity: 'common' },
  { id: 'dedicated', name: 'Dedicated', description: '7-day activity streak', icon: '🔥', category: 'streak', rarity: 'rare' },
  { id: 'streak_master', name: 'Streak Master', description: '30-day activity streak', icon: '🔥', category: 'streak', rarity: 'epic' },
  { id: 'unstoppable', name: 'Unstoppable', description: '100-day activity streak', icon: '🔥', category: 'streak', rarity: 'legendary' },
  // Misc
  { id: 'xp_1000', name: 'Rising Star', description: 'Earn 1,000 total XP', icon: '⭐', category: 'misc', rarity: 'common' },
  { id: 'xp_10000', name: 'Veteran', description: 'Earn 10,000 total XP', icon: '🌟', category: 'misc', rarity: 'rare' },
  { id: 'xp_100000', name: 'Legend', description: 'Earn 100,000 total XP', icon: '💫', category: 'misc', rarity: 'legendary' },
  { id: 'quest_finisher', name: 'Quest Finisher', description: 'Complete a quest', icon: '🏆', category: 'misc', rarity: 'rare' },
  { id: 'prompt_master', name: 'Prompt Master', description: 'Send 500 prompts', icon: '💬', category: 'misc', rarity: 'rare' },
]

const catalogMap = new Map(ACHIEVEMENT_CATALOG.map(a => [a.id, a]))

export function getAchievementInfo(id: string): AchievementInfo | undefined {
  return catalogMap.get(id)
}

export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: 'text-rpg-text-muted',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
}

export const RARITY_BG: Record<AchievementRarity, string> = {
  common: 'bg-rpg-text-dim/20',
  rare: 'bg-blue-500/20',
  epic: 'bg-purple-500/20',
  legendary: 'bg-yellow-500/20 animate-pulse',
}
