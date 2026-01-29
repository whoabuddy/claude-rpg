/**
 * Session manager
 */

import { createLogger } from '../lib/logger'
import { eventBus } from '../events'
import type { SessionStatusChangedEvent } from '../events/types'
import { transitionSession, isValidSessionTransition } from './state-machine'
import { reconcile } from './reconciler'
import { parseTerminal } from '../terminal'
import type { ClaudeSession, SessionStatus, SessionUpdate } from './types'

const log = createLogger('session-manager')

// Session cache by pane ID
const sessions = new Map<string, ClaudeSession>()

// Track when terminal content last changed
const terminalChangeTimestamps = new Map<string, number>()

/**
 * Get or create a session for a pane
 */
export function getOrCreateSession(
  paneId: string,
  personaId: string | null,
  projectId: string | null
): ClaudeSession {
  let session = sessions.get(paneId)

  if (session) {
    // Update persona/project if provided
    if (personaId && !session.personaId) {
      session.personaId = personaId
    }
    if (projectId && !session.projectId) {
      session.projectId = projectId
    }
    return session
  }

  const now = new Date().toISOString()
  session = {
    id: crypto.randomUUID(),
    paneId,
    personaId,
    projectId,
    status: 'idle',
    statusSource: 'hook',
    statusChangedAt: now,
    lastActivityAt: now,
  }

  sessions.set(paneId, session)
  log.info('Created session', { paneId, id: session.id })

  return session
}

/**
 * Get session by pane ID
 */
export function getSession(paneId: string): ClaudeSession | null {
  return sessions.get(paneId) || null
}

/**
 * Get all active sessions
 */
export function getAllSessions(): ClaudeSession[] {
  return Array.from(sessions.values())
}

/**
 * Update session status from a hook event
 */
export async function updateFromHook(paneId: string, status: SessionStatus): Promise<void> {
  const session = sessions.get(paneId)
  if (!session) {
    log.warn('Session not found for hook update', { paneId })
    return
  }

  await updateSessionStatus(session, {
    status,
    source: 'hook',
    reason: 'Hook event',
  })
}

/**
 * Update session from terminal content
 */
export async function updateFromTerminal(paneId: string, content: string): Promise<void> {
  const session = sessions.get(paneId)
  if (!session) {
    return
  }

  // Track content change
  const contentHash = simpleHash(content)
  const previousHash = session.terminalContent ? simpleHash(session.terminalContent) : null
  if (contentHash !== previousHash) {
    terminalChangeTimestamps.set(paneId, Date.now())
  }
  session.terminalContent = content

  // Parse terminal
  const detection = parseTerminal(content)
  session.terminalConfidence = detection.confidence

  // Calculate time since changes
  const hookChangeTime = new Date(session.statusChangedAt).getTime()
  const terminalChangeTime = terminalChangeTimestamps.get(paneId) || Date.now()

  // Reconcile
  const result = reconcile({
    hookStatus: session.status,
    terminalDetection: detection,
    timeSinceHookChange: Date.now() - hookChangeTime,
    timeSinceTerminalChange: Date.now() - terminalChangeTime,
  })

  if (result.status !== session.status) {
    await updateSessionStatus(session, {
      status: result.status,
      source: result.source === 'hook' ? 'hook' : result.source === 'terminal' ? 'terminal' : 'reconciler',
      reason: result.reason,
    })
  }
}

/**
 * Update session status with validation
 */
async function updateSessionStatus(session: ClaudeSession, update: SessionUpdate): Promise<void> {
  const oldStatus = session.status

  // Skip if no change
  if (oldStatus === update.status) {
    return
  }

  // Validate transition
  if (!isValidSessionTransition(oldStatus, update.status)) {
    log.warn('Invalid session transition, forcing', {
      paneId: session.paneId,
      from: oldStatus,
      to: update.status,
      reason: update.reason,
    })
  }

  // Apply update
  const now = new Date().toISOString()
  session.status = update.status
  session.statusSource = update.source
  session.statusChangedAt = now
  session.lastActivityAt = now

  log.debug('Session status updated', {
    paneId: session.paneId,
    from: oldStatus,
    to: update.status,
    source: update.source,
    reason: update.reason,
  })

  // Emit event
  if (session.personaId) {
    await eventBus.emit<SessionStatusChangedEvent>({
      type: 'session:status_changed',
      paneId: session.paneId,
      personaId: session.personaId,
      oldStatus,
      newStatus: update.status,
    })
  }
}

/**
 * Remove session
 */
export function removeSession(paneId: string): void {
  const session = sessions.get(paneId)
  if (session) {
    sessions.delete(paneId)
    terminalChangeTimestamps.delete(paneId)
    log.info('Removed session', { paneId, id: session.id })
  }
}

/**
 * Simple string hash for change detection
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash
}
