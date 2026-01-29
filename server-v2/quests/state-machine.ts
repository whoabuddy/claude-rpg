/**
 * Quest and phase state machines
 */

import { createLogger } from '../lib/logger'
import type { QuestStatus, QuestPhaseStatus } from './types'

const log = createLogger('quest-state')

/**
 * Valid transitions for quest status
 */
export const VALID_QUEST_TRANSITIONS: Record<QuestStatus, QuestStatus[]> = {
  planned: ['active', 'archived'],
  active: ['paused', 'completed', 'failed'],
  paused: ['active', 'archived'],
  completed: ['archived'],
  failed: ['archived', 'active'], // Can retry
  archived: [], // Terminal state
}

/**
 * Valid transitions for phase status
 */
export const VALID_PHASE_TRANSITIONS: Record<QuestPhaseStatus, QuestPhaseStatus[]> = {
  pending: ['planned', 'skipped'],
  planned: ['executing', 'skipped'],
  executing: ['completed', 'failed', 'retrying'],
  retrying: ['executing', 'failed', 'skipped'],
  completed: [], // Terminal state
  failed: ['retrying', 'skipped'],
  skipped: [], // Terminal state
}

/**
 * Transition quest to a new status
 * @throws Error if transition is invalid
 */
export function transitionQuest(current: QuestStatus, next: QuestStatus): QuestStatus {
  const validNextStates = VALID_QUEST_TRANSITIONS[current]

  if (!validNextStates.includes(next)) {
    const error = `Invalid quest transition: ${current} -> ${next}. Valid: ${validNextStates.join(', ')}`
    log.warn('Invalid quest transition', { current, next, valid: validNextStates })
    throw new Error(error)
  }

  log.debug('Quest transition', { from: current, to: next })
  return next
}

/**
 * Transition phase to a new status
 * @throws Error if transition is invalid
 */
export function transitionPhase(current: QuestPhaseStatus, next: QuestPhaseStatus): QuestPhaseStatus {
  const validNextStates = VALID_PHASE_TRANSITIONS[current]

  if (!validNextStates.includes(next)) {
    const error = `Invalid phase transition: ${current} -> ${next}. Valid: ${validNextStates.join(', ')}`
    log.warn('Invalid phase transition', { current, next, valid: validNextStates })
    throw new Error(error)
  }

  log.debug('Phase transition', { from: current, to: next })
  return next
}

/**
 * Check if a quest transition is valid
 */
export function isValidQuestTransition(current: QuestStatus, next: QuestStatus): boolean {
  return VALID_QUEST_TRANSITIONS[current]?.includes(next) ?? false
}

/**
 * Check if a phase transition is valid
 */
export function isValidPhaseTransition(current: QuestPhaseStatus, next: QuestPhaseStatus): boolean {
  return VALID_PHASE_TRANSITIONS[current]?.includes(next) ?? false
}

/**
 * Check if a quest status is terminal
 */
export function isQuestTerminal(status: QuestStatus): boolean {
  return VALID_QUEST_TRANSITIONS[status]?.length === 0
}

/**
 * Check if a phase status is terminal
 */
export function isPhaseTerminal(status: QuestPhaseStatus): boolean {
  return VALID_PHASE_TRANSITIONS[status]?.length === 0
}

/**
 * Get next suggested status for a quest
 */
export function getNextQuestStatus(status: QuestStatus): QuestStatus | null {
  const transitions = VALID_QUEST_TRANSITIONS[status]
  if (!transitions || transitions.length === 0) return null
  // Prefer non-terminal states
  return transitions.find(s => !isQuestTerminal(s)) ?? transitions[0]
}

/**
 * Get next suggested status for a phase
 */
export function getNextPhaseStatus(status: QuestPhaseStatus): QuestPhaseStatus | null {
  const transitions = VALID_PHASE_TRANSITIONS[status]
  if (!transitions || transitions.length === 0) return null
  // Prefer forward progress
  if (status === 'pending') return 'planned'
  if (status === 'planned') return 'executing'
  if (status === 'executing') return 'completed'
  if (status === 'retrying') return 'executing'
  if (status === 'failed') return 'retrying'
  return transitions[0]
}
