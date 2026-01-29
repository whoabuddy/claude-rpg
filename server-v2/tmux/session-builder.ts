/**
 * Build ClaudeSessionInfo for panes
 */

import { createLogger } from '../lib/logger'
import { getOrCreatePersona, getPersonaById } from '../personas/service'
import { getSession } from '../sessions/manager'
import type { ClaudeSessionInfo } from './types'

const log = createLogger('session-builder')

/**
 * Build ClaudeSessionInfo for a pane with a Claude process
 */
export async function buildClaudeSessionInfo(
  paneId: string,
  sessionId?: string
): Promise<ClaudeSessionInfo | undefined> {
  // Get session from session manager
  const session = getSession(paneId)

  // If no session and no sessionId, can't build info
  if (!session && !sessionId) {
    return undefined
  }

  try {
    // Get or create persona
    const sid = sessionId || session?.id || crypto.randomUUID()
    const persona = await getOrCreatePersona(sid)

    // Build session info with persona data
    const now = Date.now()
    const sessionInfo: ClaudeSessionInfo = {
      id: sid,
      name: persona.name,
      avatarSvg: persona.avatarUrl || undefined,
      status: session?.status || 'idle',
      tier: persona.tier,
      badges: persona.badges,
      personality: persona.personality,
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
        lastActivity: Date.now(),
      }
    }
  }

  return sessionInfo
}
