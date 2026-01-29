/**
 * Session state machine
 */

import { createLogger } from '../lib/logger'
import type { SessionStatus } from './types'

const log = createLogger('session-state')

/**
 * Valid session status transitions
 */
export const VALID_SESSION_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  idle: ['typing', 'working', 'waiting', 'error'],
  typing: ['idle', 'working', 'waiting', 'error'],
  working: ['idle', 'waiting', 'error'],
  waiting: ['idle', 'typing', 'working', 'error'],
  error: ['idle', 'working', 'waiting'],
}

/**
 * Transition session to a new status
 * @throws Error if transition is invalid
 */
export function transitionSession(current: SessionStatus, next: SessionStatus): SessionStatus {
  // Same state is always valid (no-op)
  if (current === next) {
    return next
  }

  const validNextStates = VALID_SESSION_TRANSITIONS[current]

  if (!validNextStates.includes(next)) {
    const error = `Invalid session transition: ${current} -> ${next}. Valid: ${validNextStates.join(', ')}`
    log.warn('Invalid session transition', { current, next, valid: validNextStates })
    throw new Error(error)
  }

  log.debug('Session transition', { from: current, to: next })
  return next
}

/**
 * Check if a session transition is valid
 */
export function isValidSessionTransition(current: SessionStatus, next: SessionStatus): boolean {
  if (current === next) return true
  return VALID_SESSION_TRANSITIONS[current]?.includes(next) ?? false
}

/**
 * Get status priority (higher = more important)
 * Used for reconciliation when multiple sources disagree
 */
export function getStatusPriority(status: SessionStatus): number {
  const priorities: Record<SessionStatus, number> = {
    error: 5,
    waiting: 4,
    working: 3,
    typing: 2,
    idle: 1,
  }
  return priorities[status]
}
