/**
 * Challenge system for personas
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import type { ChallengeDefinition, PersonaChallenge, ChallengePeriod, ChallengeStatus } from './types'

const log = createLogger('challenges')

// Import addXp to award XP on challenge completion
let addXp: ((personaId: string, amount: number) => void) | null = null

/**
 * Initialize challenge system with XP service
 * Must be called after persona service is initialized to avoid circular deps
 */
export function initChallengeSystem(addXpFn: (personaId: string, amount: number) => void): void {
  addXp = addXpFn
  log.info('Challenge system initialized with XP service')
}

/**
 * Daily challenges (reset every day at midnight)
 */
export const DAILY_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'run-tests',
    name: 'Test Runner',
    description: 'Run 3 tests',
    period: 'daily',
    target: 3,
    stat: 'commands.testsRun',
    xpReward: 25,
  },
  {
    id: 'make-commits',
    name: 'Commit Streak',
    description: 'Make 2 commits',
    period: 'daily',
    target: 2,
    stat: 'git.commits',
    xpReward: 30,
  },
  {
    id: 'use-tools',
    name: 'Tool Master',
    description: 'Use 10 tools',
    period: 'daily',
    target: 10,
    stat: 'toolsUsed',
    xpReward: 20,
  },
  {
    id: 'receive-prompts',
    name: 'Active Session',
    description: 'Receive 5 prompts',
    period: 'daily',
    target: 5,
    stat: 'promptsReceived',
    xpReward: 15,
  },
]

/**
 * Weekly challenges (reset every Monday at midnight)
 */
export const WEEKLY_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'complete-phase',
    name: 'Quest Progress',
    description: 'Complete a quest phase',
    period: 'weekly',
    target: 1,
    stat: 'quests.phasesCompleted',
    xpReward: 100,
  },
  {
    id: 'earn-xp',
    name: 'XP Hunter',
    description: 'Earn 500 XP',
    period: 'weekly',
    target: 500,
    stat: 'totalXp',
    xpReward: 75,
  },
  {
    id: 'run-many-tests',
    name: 'Quality Champion',
    description: 'Run 20 tests',
    period: 'weekly',
    target: 20,
    stat: 'commands.testsRun',
    xpReward: 80,
  },
]

/**
 * Get all challenge definitions
 */
export function getAllChallengeDefinitions(): ChallengeDefinition[] {
  return [...DAILY_CHALLENGES, ...WEEKLY_CHALLENGES]
}

/**
 * Get challenge definition by ID
 */
export function getChallengeDefinition(challengeId: string): ChallengeDefinition | null {
  return getAllChallengeDefinitions().find(c => c.id === challengeId) || null
}

/**
 * Calculate expiration time for a challenge period
 */
function getExpirationTime(period: ChallengePeriod): string {
  const now = new Date()

  if (period === 'daily') {
    // Expire at midnight tonight
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.toISOString()
  } else {
    // Expire next Monday at midnight
    const nextMonday = new Date(now)
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
    nextMonday.setHours(0, 0, 0, 0)
    return nextMonday.toISOString()
  }
}

/**
 * Assign daily challenges to a persona
 * Returns newly assigned challenges
 */
export function assignDailyChallenges(personaId: string): PersonaChallenge[] {
  const now = new Date().toISOString()
  const expiresAt = getExpirationTime('daily')
  const assigned: PersonaChallenge[] = []

  for (const definition of DAILY_CHALLENGES) {
    const id = crypto.randomUUID()

    try {
      queries.insertChallenge.run(
        id,
        personaId,
        definition.id,
        definition.period,
        'active',
        0, // progress
        definition.target,
        definition.xpReward,
        now,
        expiresAt,
        null // completed_at
      )

      assigned.push({
        id,
        personaId,
        challengeId: definition.id,
        period: definition.period,
        status: 'active',
        progress: 0,
        target: definition.target,
        xpReward: definition.xpReward,
        assignedAt: now,
        expiresAt,
      })

      log.info('Assigned daily challenge', { personaId, challengeId: definition.id })
    } catch (error) {
      log.error('Failed to assign daily challenge', {
        personaId,
        challengeId: definition.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return assigned
}

/**
 * Assign weekly challenges to a persona
 * Returns newly assigned challenges
 */
export function assignWeeklyChallenges(personaId: string): PersonaChallenge[] {
  const now = new Date().toISOString()
  const expiresAt = getExpirationTime('weekly')
  const assigned: PersonaChallenge[] = []

  for (const definition of WEEKLY_CHALLENGES) {
    const id = crypto.randomUUID()

    try {
      queries.insertChallenge.run(
        id,
        personaId,
        definition.id,
        definition.period,
        'active',
        0, // progress
        definition.target,
        definition.xpReward,
        now,
        expiresAt,
        null // completed_at
      )

      assigned.push({
        id,
        personaId,
        challengeId: definition.id,
        period: definition.period,
        status: 'active',
        progress: 0,
        target: definition.target,
        xpReward: definition.xpReward,
        assignedAt: now,
        expiresAt,
      })

      log.info('Assigned weekly challenge', { personaId, challengeId: definition.id })
    } catch (error) {
      log.error('Failed to assign weekly challenge', {
        personaId,
        challengeId: definition.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return assigned
}

/**
 * Get active challenges for a persona
 */
export function getActiveChallenges(personaId: string): PersonaChallenge[] {
  const results = queries.getActiveChallengesByPersona.all(personaId) as Array<Record<string, unknown>>
  return results.map(mapDbToChallenge)
}

/**
 * Get all challenges for a persona (including completed and expired)
 */
export function getAllChallenges(personaId: string): PersonaChallenge[] {
  const results = queries.getAllChallengesByPersona.all(personaId) as Array<Record<string, unknown>>
  return results.map(mapDbToChallenge)
}

/**
 * Check if a challenge is completed
 */
export function checkChallengeCompletion(challenge: PersonaChallenge): boolean {
  return challenge.progress >= challenge.target
}

/**
 * Update challenge progress
 * Returns the challenge if it was updated and completed, null otherwise
 */
export function updateChallengeProgress(
  personaId: string,
  stat: string,
  delta: number
): PersonaChallenge | null {
  // Get all active challenges for this persona
  const activeChallenges = getActiveChallenges(personaId)

  // Find challenges that track this stat
  const relevantChallenges = activeChallenges.filter(c => {
    const definition = getChallengeDefinition(c.challengeId)
    return definition?.stat === stat
  })

  if (relevantChallenges.length === 0) {
    return null
  }

  // Update progress on all relevant challenges
  for (const challenge of relevantChallenges) {
    const newProgress = challenge.progress + delta

    queries.updateChallengeProgress.run(newProgress, challenge.id)

    // Check if challenge is now complete
    if (newProgress >= challenge.target && challenge.status === 'active') {
      const now = new Date().toISOString()
      queries.completeChallenge.run('completed', now, challenge.id)

      log.info('Challenge completed', {
        personaId,
        challengeId: challenge.challengeId,
        progress: newProgress,
        target: challenge.target,
        xpReward: challenge.xpReward,
      })

      // Award XP for challenge completion
      if (!addXp) {
        log.error('Challenge XP service not initialized - this should never happen', {
          personaId,
          challengeId: challenge.challengeId,
        })
        throw new Error('Challenge system not properly initialized')
      }

      addXp(personaId, challenge.xpReward)
      log.debug('Awarded XP for challenge completion', {
        personaId,
        challengeId: challenge.challengeId,
        xpReward: challenge.xpReward,
      })

      // Return the completed challenge (refresh from DB to get updated status)
      const updated = queries.getChallengeById.get(challenge.id) as Record<string, unknown> | null
      return updated ? mapDbToChallenge(updated) : null
    }
  }

  return null
}

/**
 * Expire old challenges
 * Called periodically to clean up challenges past their expiration
 */
export function expireOldChallenges(): void {
  const now = new Date().toISOString()

  try {
    const result = queries.expireChallenges.run(now)
    const changed = (result as { changes?: number }).changes || 0

    if (changed > 0) {
      log.info('Expired old challenges', { count: changed })
    }
  } catch (error) {
    log.error('Failed to expire challenges', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Check if persona needs new challenges assigned
 * Returns period types that need assignment ('daily', 'weekly', or both)
 */
export function checkNeedsAssignment(personaId: string): ChallengePeriod[] {
  const activeChallenges = getActiveChallenges(personaId)
  const needs: ChallengePeriod[] = []

  // Check if any daily challenges are active
  const hasDailyChallenge = activeChallenges.some(c => c.period === 'daily')
  if (!hasDailyChallenge) {
    needs.push('daily')
  }

  // Check if any weekly challenges are active
  const hasWeeklyChallenge = activeChallenges.some(c => c.period === 'weekly')
  if (!hasWeeklyChallenge) {
    needs.push('weekly')
  }

  return needs
}

/**
 * Auto-assign challenges if needed
 * Called when persona becomes active
 */
export function autoAssignChallenges(personaId: string): PersonaChallenge[] {
  const needs = checkNeedsAssignment(personaId)
  const assigned: PersonaChallenge[] = []

  if (needs.includes('daily')) {
    assigned.push(...assignDailyChallenges(personaId))
  }

  if (needs.includes('weekly')) {
    assigned.push(...assignWeeklyChallenges(personaId))
  }

  return assigned
}

/**
 * Map database row to PersonaChallenge
 */
function mapDbToChallenge(row: Record<string, unknown>): PersonaChallenge {
  return {
    id: row.id as string,
    personaId: row.persona_id as string,
    challengeId: row.challenge_id as string,
    period: row.period as ChallengePeriod,
    status: row.status as ChallengeStatus,
    progress: row.progress as number,
    target: row.target as number,
    xpReward: row.xp_reward as number,
    assignedAt: row.assigned_at as string,
    expiresAt: row.expires_at as string,
    completedAt: row.completed_at as string | undefined,
  }
}
