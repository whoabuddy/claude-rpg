/**
 * Build ClaudeSessionInfo for panes
 */

import { createLogger } from '../lib/logger'
import { getOrCreatePersona, getPersonaById } from '../personas/service'
import { getSession, getOrCreateSession } from '../sessions/manager'
import { getOrCreateProject } from '../projects/service'
import type { ClaudeSessionInfo } from './types'
import type { Persona } from '../personas/types'
import type { ClaudeSession } from '../sessions/types'

const log = createLogger('session-builder')

/**
 * Build ClaudeSessionInfo from persona and session data
 */
function buildSessionInfo(persona: Persona, session: ClaudeSession): ClaudeSessionInfo {
  const now = Date.now()
  return {
    id: persona.sessionId,
    name: persona.name,
    avatarSvg: persona.avatarUrl || undefined,
    status: session.status || 'idle',
    tier: persona.tier,
    badges: persona.badges,
    personality: persona.personality,
    health: persona.health,
    lastError: session.lastError,
    createdAt: now,
    lastActivity: now,
  }
}

/**
 * Build ClaudeSessionInfo for a pane with a Claude process
 * Creates a session and persona on-demand if they don't exist yet
 *
 * Personas are created immediately using paneId as a fallback sessionId.
 * This ensures the UI shows real persona data right away, not "Initializing...".
 * If a hook event later provides a different sessionId, we still use the
 * existing persona (keyed by paneId in the session).
 */
export async function buildClaudeSessionInfo(
  paneId: string,
  sessionId?: string,
  cwd?: string
): Promise<ClaudeSessionInfo | undefined> {
  try {
    // Get or create session for this pane
    // This ensures Claude panes always have a session, even if started before server
    const session = getSession(paneId) || getOrCreateSession(paneId, null, null)

    // Link project to session based on cwd
    if (cwd && !session.projectId) {
      try {
        const project = await getOrCreateProject(cwd)
        if (project) {
          session.projectId = project.id
          log.debug('Linked session to project', { paneId, projectId: project.id, cwd })
        }
      } catch (error) {
        // Non-fatal - session can work without a project
        log.debug('Could not link project to session', {
          paneId,
          cwd,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // If session has a persona, use its data
    if (session.personaId) {
      const persona = getPersonaById(session.personaId)
      if (persona) {
        return buildSessionInfo(persona, session)
      }
    }

    // No persona yet - create one immediately using paneId as fallback sessionId
    // This ensures the UI shows a real persona right away, not a placeholder
    const effectiveSessionId = sessionId || `pane-${paneId}`
    const persona = await getOrCreatePersona(effectiveSessionId)

    // Link persona to session
    session.personaId = persona.id
    log.debug('Auto-created persona for Claude pane', { paneId, personaId: persona.id, name: persona.name })

    return buildSessionInfo(persona, session)
  } catch (error) {
    log.error('Failed to build ClaudeSessionInfo', {
      paneId,
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

/**
 * Update existing ClaudeSessionInfo with latest persona data
 */
export function updateClaudeSessionInfo(
  sessionInfo: ClaudeSessionInfo,
  sessionId: string
): ClaudeSessionInfo {
  // Get persona to refresh data
  const session = getSession(sessionId)
  if (session?.personaId) {
    const persona = getPersonaById(session.personaId)
    if (persona) {
      return {
        ...sessionInfo,
        tier: persona.tier,
        badges: persona.badges,
        personality: persona.personality,
        health: persona.health,
        lastActivity: Date.now(),
      }
    }
  }

  return sessionInfo
}
