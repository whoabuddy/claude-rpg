/**
 * Build ClaudeSessionInfo for panes
 */

import { createLogger } from '../lib/logger'
import { getOrCreatePersona, getPersonaById } from '../personas/service'
import { getSession, getOrCreateSession } from '../sessions/manager'
import { getOrCreateProject } from '../projects/service'
import type { ClaudeSessionInfo } from './types'

const log = createLogger('session-builder')

/**
 * Build ClaudeSessionInfo for a pane with a Claude process
 * Creates a session on-demand if one doesn't exist yet
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
    const sid = sessionId || session.id

    // Get or create persona
    const persona = await getOrCreatePersona(sid)

    // Link persona to session if not already linked
    if (!session.personaId) {
      session.personaId = persona.id
    }

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

    // Build session info with persona data
    const now = Date.now()
    const sessionInfo: ClaudeSessionInfo = {
      id: sid,
      name: persona.name,
      avatarSvg: persona.avatarUrl || undefined,
      status: session.status || 'idle',
      tier: persona.tier,
      badges: persona.badges,
      personality: persona.personality,
      health: persona.health,
      createdAt: now,
      lastActivity: now,
    }

    return sessionInfo
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
