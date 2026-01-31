/**
 * Session state reconciler
 *
 * Resolves conflicts between hook-reported state and terminal-detected state.
 */

import { createLogger } from '../lib/logger'
import type { SessionStatus } from './types'
import type { TerminalDetection } from '../terminal/types'

const log = createLogger('session-reconciler')

// Thresholds (increased from 3s/5s to reduce false idle detection)
const IDLE_TIMEOUT_MS = 10000 // Trust terminal idle after 10s of working
const UNKNOWN_TIMEOUT_MS = 15000 // Assume idle after 15s of unknown
const HOOK_PRECEDENCE_MS = 5000 // Trust hook status for 5s after hook event
const ERROR_STALE_MS = 10000 // Clear stale error after 10s if terminal shows working/idle

export interface ReconciliationInput {
  hookStatus: SessionStatus
  terminalDetection: TerminalDetection
  timeSinceHookChange: number // ms since last hook status change
  timeSinceTerminalChange: number // ms since terminal content changed
  timeSinceHookEvent?: number // ms since last hook event (for precedence lock)
  timeSinceError?: number // ms since last error (for error staleness)
  hasActiveSubagents?: boolean // Guard: don't idle if subagents are still running
}

export interface ReconciliationResult {
  status: SessionStatus
  source: 'hook' | 'terminal' | 'timeout'
  confidence: number
  reason: string
}

/**
 * Reconcile hook state with terminal state
 */
export function reconcile(input: ReconciliationInput): ReconciliationResult {
  const { hookStatus, terminalDetection, timeSinceHookChange, timeSinceTerminalChange, timeSinceHookEvent, timeSinceError, hasActiveSubagents } = input

  log.debug('Reconciling session state', {
    hookStatus,
    terminalStatus: terminalDetection.status,
    terminalConfidence: terminalDetection.confidence,
    timeSinceHookChange,
    timeSinceTerminalChange,
    timeSinceHookEvent,
    timeSinceError,
    hasActiveSubagents,
  })

  // Rule 1: Terminal shows prompt while hook says working → trust terminal (waiting)
  if (
    hookStatus === 'working' &&
    terminalDetection.status === 'waiting' &&
    terminalDetection.confidence > 0.7
  ) {
    return {
      status: 'waiting',
      source: 'terminal',
      confidence: terminalDetection.confidence,
      reason: 'Terminal shows prompt while hook says working',
    }
  }

  // Rule 2: Hook says waiting but no prompt visible → prompt was answered
  if (
    hookStatus === 'waiting' &&
    terminalDetection.status !== 'waiting' &&
    terminalDetection.confidence > 0.6
  ) {
    const newStatus = terminalDetection.status === 'unknown' ? 'working' : terminalDetection.status
    return {
      status: newStatus as SessionStatus,
      source: 'terminal',
      confidence: terminalDetection.confidence,
      reason: 'Prompt no longer visible, assuming answered',
    }
  }

  // Rule 3: Terminal shows error → trust terminal
  if (
    terminalDetection.status === 'error' &&
    terminalDetection.confidence > 0.75
  ) {
    return {
      status: 'error',
      source: 'terminal',
      confidence: terminalDetection.confidence,
      reason: 'Terminal shows error',
    }
  }

  // Rule 3.5: Error staleness - if hook says error but terminal shows working/idle for 10s+
  // This handles cases where Claude recovered from an error but we missed the update
  if (
    hookStatus === 'error' &&
    timeSinceError !== undefined &&
    timeSinceError > ERROR_STALE_MS &&
    (terminalDetection.status === 'working' || terminalDetection.status === 'idle') &&
    terminalDetection.confidence > 0.6
  ) {
    return {
      status: terminalDetection.status as SessionStatus,
      source: 'timeout',
      confidence: 0.7,
      reason: `Stale error (${Math.round(timeSinceError / 1000)}s), terminal shows ${terminalDetection.status}`,
    }
  }

  // Rule 4: Hook says working, terminal idle for 10s+ → missed stop hook
  // Respect hook precedence: don't override if hook event was recent
  // Guard: don't idle if subagents are still running
  if (
    hookStatus === 'working' &&
    terminalDetection.status === 'idle' &&
    terminalDetection.confidence > 0.6 &&
    timeSinceTerminalChange > IDLE_TIMEOUT_MS &&
    (timeSinceHookEvent === undefined || timeSinceHookEvent > HOOK_PRECEDENCE_MS) &&
    !hasActiveSubagents
  ) {
    return {
      status: 'idle',
      source: 'timeout',
      confidence: 0.8,
      reason: `Terminal idle for ${Math.round(timeSinceTerminalChange / 1000)}s while hook says working`,
    }
  }

  // Rule 5: Hook says working, terminal unknown for 15s+ → assume done
  // Respect hook precedence: don't override if hook event was recent
  // Guard: don't idle if subagents are still running
  if (
    hookStatus === 'working' &&
    terminalDetection.status === 'unknown' &&
    timeSinceHookChange > UNKNOWN_TIMEOUT_MS &&
    (timeSinceHookEvent === undefined || timeSinceHookEvent > HOOK_PRECEDENCE_MS) &&
    !hasActiveSubagents
  ) {
    return {
      status: 'idle',
      source: 'timeout',
      confidence: 0.6,
      reason: `Hook working for ${Math.round(timeSinceHookChange / 1000)}s with unknown terminal state`,
    }
  }

  // Default: trust hook status if terminal confidence is low
  if (terminalDetection.confidence < 0.5) {
    return {
      status: hookStatus,
      source: 'hook',
      confidence: 0.7,
      reason: 'Low terminal confidence, trusting hook',
    }
  }

  // Default: use terminal status if confidence is high
  if (terminalDetection.confidence > 0.8 && terminalDetection.status !== 'unknown') {
    return {
      status: terminalDetection.status as SessionStatus,
      source: 'terminal',
      confidence: terminalDetection.confidence,
      reason: 'High terminal confidence',
    }
  }

  // Fallback: trust hook
  return {
    status: hookStatus,
    source: 'hook',
    confidence: 0.6,
    reason: 'Default to hook status',
  }
}
