/**
 * XP calculation for events
 */

/**
 * XP values for each event type
 */
export const XP_VALUES: Record<string, number> = {
  // Tool usage
  'tool:Read': 1,
  'tool:Edit': 3,
  'tool:Write': 5,
  'tool:Bash': 2,
  'tool:Task': 5,
  'tool:Grep': 1,
  'tool:Glob': 1,
  'tool:WebFetch': 2,
  'tool:WebSearch': 2,

  // Git operations
  'git:commit': 15,
  'git:push': 10,
  'git:branch': 5,
  'git:pr_created': 20,
  'git:pr_merged': 50,
  'git:merge': 10,
  'git:rebase': 10,

  // Quest milestones
  'quest:created': 5,
  'quest:phase_planned': 10,
  'quest:phase_completed': 25,
  'quest:phase_verified': 25,
  'quest:completed': 100,

  // Achievements
  'achievement:unlocked': 25,
  'achievement:rare': 50,
  'achievement:legendary': 100,

  // Bonuses
  'bonus:streak': 10,
  'bonus:daily': 5,
  'bonus:milestone': 50,
}

/**
 * Calculate XP for an event
 */
export function calculateXp(eventType: string, metadata?: Record<string, unknown>): number {
  // Direct lookup
  if (eventType in XP_VALUES) {
    return XP_VALUES[eventType]
  }

  // Check for tool: prefix variations
  if (eventType.startsWith('tool:')) {
    return XP_VALUES['tool:Bash'] ?? 2 // Default for unknown tools
  }

  // Check for git: prefix variations
  if (eventType.startsWith('git:')) {
    return 5 // Default for unknown git ops
  }

  // Check for metadata-based modifiers
  if (metadata) {
    // Lines changed bonus for edits
    if (eventType.includes('Edit') && typeof metadata.linesChanged === 'number') {
      const baseXp = XP_VALUES['tool:Edit'] ?? 3
      const bonus = Math.floor(metadata.linesChanged / 10) // 1 bonus XP per 10 lines
      return baseXp + Math.min(bonus, 10) // Cap at 10 bonus
    }
  }

  // Default XP for unknown events
  return 1
}

/**
 * Get XP category from event type
 */
export function getXpCategory(eventType: string): string {
  if (eventType.startsWith('tool:')) return 'tool_use'
  if (eventType.startsWith('git:')) return 'git'
  if (eventType.startsWith('quest:')) return 'quest'
  if (eventType.startsWith('achievement:')) return 'achievement'
  if (eventType.startsWith('bonus:')) return 'bonus'
  return 'other'
}
