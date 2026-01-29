/**
 * Session state reconciler
 *
 * Resolves conflicts between hook-reported state and terminal-detected state.
 */

import { createLogger } from '../lib/logger'
import type { SessionStatus } from './types'
import type { TerminalDetection } from '../terminal/types'

const log = createLogger('session-reconciler')

// Thresholds
const IDLE_TIMEOUT_MS = 5000 // Trust terminal idle after 5s of working
const UNKNOWN_TIMEOUT_MS = 10000 // Assume idle after 10s of unknown

export interface ReconciliationInput {
  hookStatus: SessionStatus
  terminalDetection: TerminalDetection
  timeSinceHookChange: number // ms since last hook status change
  timeSinceTerminalChange: number // ms since terminal content changed
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
  const { hookStatus, terminalDetection, timeSinceHookChange, timeSinceTerminalChange } = input

  log.debug('Reconciling session state', {
    hookStatus,
    terminalStatus: terminalDetection.status,
    terminalConfidence: terminalDetection.confidence,
    timeSinceHookChange,
    timeSinceTerminalChange,
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

  // Rule 4: Hook says working, terminal idle for 5s+ → missed stop hook
  if (
    hookStatus === 'working' &&
    terminalDetection.status === 'idle' &&
    terminalDetection.confidence > 0.6 &&
    timeSinceTerminalChange > IDLE_TIMEOUT_MS
  ) {
    return {
      status: 'idle',
      source: 'timeout',
      confidence: 0.8,
      reason: `Terminal idle for ${Math.round(timeSinceTerminalChange / 1000)}s while hook says working`,
    }
  }

  // Rule 5: Hook says working, terminal unknown for 10s+ → assume done
  if (
    hookStatus === 'working' &&
    terminalDetection.status === 'unknown' &&
    timeSinceHookChange > UNKNOWN_TIMEOUT_MS
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
