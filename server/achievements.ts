import type { AchievementDefinition, AchievementMeta, CompanionStats, StreakInfo, Achievement } from '@shared/types'

// ═══════════════════════════════════════════════════════════════════════════
// Achievement Definitions Catalog
// ═══════════════════════════════════════════════════════════════════════════

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── Getting Started ──────────────────────────────────────────────────────
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Make your first commit',
    icon: '🗡️',
    category: 'getting_started',
    rarity: 'common',
    check: (s) => s.git.commits >= 1,
  },
  {
    id: 'hello_world',
    name: 'Hello World',
    description: 'Send your first prompt',
    icon: '👋',
    category: 'getting_started',
    rarity: 'common',
    check: (s) => s.promptsReceived >= 1,
  },
  {
    id: 'tool_time',
    name: 'Tool Time',
    description: 'Use 10 different tools',
    icon: '🔧',
    category: 'getting_started',
    rarity: 'common',
    check: (_s, _st, m) => (m?.toolsUsedCount ?? 0) >= 10,
  },

  // ── Git Mastery ──────────────────────────────────────────────────────────
  {
    id: 'committer',
    name: 'Committer',
    description: 'Make 10 commits',
    icon: '📝',
    category: 'git',
    rarity: 'common',
    check: (s) => s.git.commits >= 10,
  },
  {
    id: 'century',
    name: 'Century',
    description: 'Make 100 commits',
    icon: '💯',
    category: 'git',
    rarity: 'rare',
    check: (s) => s.git.commits >= 100,
  },
  {
    id: 'pr_champion',
    name: 'PR Champion',
    description: 'Create 10 pull requests',
    icon: '🏅',
    category: 'git',
    rarity: 'rare',
    check: (s) => s.git.prsCreated >= 10,
  },
  {
    id: 'merger',
    name: 'Merger',
    description: 'Merge 5 pull requests',
    icon: '🔀',
    category: 'git',
    rarity: 'rare',
    check: (s) => s.git.prsMerged >= 5,
  },
  {
    id: 'pusher',
    name: 'Pusher',
    description: 'Push 50 times',
    icon: '🚀',
    category: 'git',
    rarity: 'rare',
    check: (s) => s.git.pushes >= 50,
  },

  // ── Testing ──────────────────────────────────────────────────────────────
  {
    id: 'test_pilot',
    name: 'Test Pilot',
    description: 'Run your first test',
    icon: '🧪',
    category: 'testing',
    rarity: 'common',
    check: (s) => s.commands.testsRun >= 1,
  },
  {
    id: 'test_warrior',
    name: 'Test Warrior',
    description: 'Run 100 tests',
    icon: '⚔️',
    category: 'testing',
    rarity: 'rare',
    check: (s) => s.commands.testsRun >= 100,
  },
  {
    id: 'quality_guardian',
    name: 'Quality Guardian',
    description: 'Run 1000 tests',
    icon: '🛡️',
    category: 'testing',
    rarity: 'epic',
    check: (s) => s.commands.testsRun >= 1000,
  },

  // ── Deploy ───────────────────────────────────────────────────────────────
  {
    id: 'ship_it',
    name: 'Ship It',
    description: 'Run your first deploy',
    icon: '📦',
    category: 'deploy',
    rarity: 'common',
    check: (s) => s.commands.deploysRun >= 1,
  },
  {
    id: 'testnet_pioneer',
    name: 'Testnet Pioneer',
    description: 'Deploy to testnet',
    icon: '🌐',
    category: 'blockchain',
    rarity: 'rare',
    check: (s) => s.blockchain.testnetDeploys >= 1,
  },
  {
    id: 'mainnet_hero',
    name: 'Mainnet Hero',
    description: 'Deploy to mainnet',
    icon: '⛓️',
    category: 'blockchain',
    rarity: 'epic',
    check: (s) => s.blockchain.mainnetDeploys >= 1,
  },
  {
    id: 'clarity_sage',
    name: 'Clarity Sage',
    description: 'Run 50 Clarinet checks',
    icon: '📜',
    category: 'blockchain',
    rarity: 'rare',
    check: (s) => s.blockchain.clarinetChecks >= 50,
  },

  // ── Streaks ──────────────────────────────────────────────────────────────
  {
    id: 'consistent',
    name: 'Consistent',
    description: '3-day activity streak',
    icon: '🔥',
    category: 'streak',
    rarity: 'common',
    check: (_s, st) => st.current >= 3 || st.longest >= 3,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: '7-day activity streak',
    icon: '🔥',
    category: 'streak',
    rarity: 'rare',
    check: (_s, st) => st.current >= 7 || st.longest >= 7,
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    description: '30-day activity streak',
    icon: '🔥',
    category: 'streak',
    rarity: 'epic',
    check: (_s, st) => st.current >= 30 || st.longest >= 30,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: '100-day activity streak',
    icon: '🔥',
    category: 'streak',
    rarity: 'legendary',
    check: (_s, st) => st.current >= 100 || st.longest >= 100,
  },

  // ── Misc / XP ────────────────────────────────────────────────────────────
  {
    id: 'xp_1000',
    name: 'Rising Star',
    description: 'Earn 1,000 total XP',
    icon: '⭐',
    category: 'misc',
    rarity: 'common',
    check: (_s, _st, m) => (m?.totalXP ?? 0) >= 1000,
  },
  {
    id: 'xp_10000',
    name: 'Veteran',
    description: 'Earn 10,000 total XP',
    icon: '🌟',
    category: 'misc',
    rarity: 'rare',
    check: (_s, _st, m) => (m?.totalXP ?? 0) >= 10000,
  },
  {
    id: 'xp_100000',
    name: 'Legend',
    description: 'Earn 100,000 total XP',
    icon: '💫',
    category: 'misc',
    rarity: 'legendary',
    check: (_s, _st, m) => (m?.totalXP ?? 0) >= 100000,
  },
  {
    id: 'quest_finisher',
    name: 'Quest Finisher',
    description: 'Complete a quest',
    icon: '🏆',
    category: 'misc',
    rarity: 'rare',
    check: (s) => s.quests.questsCompleted >= 1,
  },
  {
    id: 'prompt_master',
    name: 'Prompt Master',
    description: 'Send 500 prompts',
    icon: '💬',
    category: 'misc',
    rarity: 'rare',
    check: (s) => s.promptsReceived >= 500,
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// Achievement Checker
// ═══════════════════════════════════════════════════════════════════════════

const achievementMap = new Map(ACHIEVEMENTS.map(a => [a.id, a]))

export function getAchievementDef(id: string): AchievementDefinition | undefined {
  return achievementMap.get(id)
}

/**
 * Check all achievements for a companion. Returns newly unlocked achievement IDs.
 */
export function checkAchievements(
  stats: CompanionStats,
  streak: StreakInfo,
  existing: Achievement[],
  meta: AchievementMeta,
): string[] {
  const unlocked = new Set(existing.map(a => a.id))
  const newlyUnlocked: string[] = []

  for (const def of ACHIEVEMENTS) {
    if (unlocked.has(def.id)) continue
    if (def.check(stats, streak, meta)) {
      newlyUnlocked.push(def.id)
    }
  }

  return newlyUnlocked
}
