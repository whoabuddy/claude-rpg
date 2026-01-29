/**
 * Badge system for personas based on stat achievements
 */

export interface BadgeDefinition {
  id: string
  name: string
  description: string
  icon: string
  requirement: (stats: Record<string, number>) => boolean
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'code_architect',
    name: 'Code Architect',
    description: 'Edit 100+ files',
    icon: '🏗️',
    requirement: (stats) => (stats.files_edited || 0) >= 100,
  },
  {
    id: 'test_champion',
    name: 'Test Champion',
    description: 'Run 50+ tests',
    icon: '🧪',
    requirement: (stats) => (stats.tests_run || 0) >= 50,
  },
  {
    id: 'git_master',
    name: 'Git Master',
    description: 'Create 50+ commits',
    icon: '📝',
    requirement: (stats) => (stats.commits_created || 0) >= 50,
  },
  {
    id: 'shell_sage',
    name: 'Shell Sage',
    description: 'Run 100+ bash commands',
    icon: '💻',
    requirement: (stats) => (stats.bash_commands || 0) >= 100,
  },
  {
    id: 'wordsmith',
    name: 'Wordsmith',
    description: 'Write 50+ files',
    icon: '✍️',
    requirement: (stats) => (stats.files_written || 0) >= 50,
  },
  {
    id: 'clarity_coder',
    name: 'Clarity Coder',
    description: 'Edit 10+ Clarity files',
    icon: '⚡',
    requirement: (stats) => (stats.clarity_files_edited || 0) >= 10,
  },
]

export function checkBadges(stats: Record<string, number>): string[] {
  return BADGES
    .filter((badge) => badge.requirement(stats))
    .map((badge) => badge.id)
}

export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.id === id)
}
