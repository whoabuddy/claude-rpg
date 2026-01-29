/**
 * Persona service
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import { fetchBitcoinFace, getFallbackAvatarUrl } from './avatar'
import { generateNameFromSessionId, generateUniqueName } from './names'
import type { Persona, PersonaStatus } from './types'

const log = createLogger('persona-service')

/**
 * Get or create a persona for a session ID
 */
export async function getOrCreatePersona(sessionId: string): Promise<Persona> {
  // Check if persona already exists
  const existing = queries.getPersonaBySessionId.get(sessionId) as Record<string, unknown> | null

  if (existing) {
    log.debug('Found existing persona', { sessionId, id: existing.id })
    return mapDbToPersona(existing)
  }

  // Get existing names to avoid duplicates
  const allPersonas = queries.getAllPersonas.all() as Array<Record<string, unknown>>
  const existingNames = new Set(allPersonas.map(p => p.name as string))

  // Generate name - try deterministic first, fall back to random unique
  let name = generateNameFromSessionId(sessionId)
  if (existingNames.has(name)) {
    name = generateUniqueName(existingNames)
  }

  // Fetch avatar (non-blocking, will use fallback if fails)
  let avatarUrl = await fetchBitcoinFace(sessionId)
  if (!avatarUrl) {
    avatarUrl = getFallbackAvatarUrl(sessionId)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  queries.insertPersona.run(
    id,
    sessionId,
    name,
    avatarUrl,
    'active' as PersonaStatus,
    0, // total_xp
    1, // level
    now, // created_at
    now  // last_seen_at
  )

  log.info('Created new persona', { id, sessionId, name })

  return {
    id,
    sessionId,
    name,
    avatarUrl,
    status: 'active',
    totalXp: 0,
    level: 1,
    createdAt: now,
    lastSeenAt: now,
  }
}

/**
 * Update last seen timestamp
 */
export function updateLastSeen(personaId: string): void {
  const now = new Date().toISOString()
  queries.updatePersonaLastSeen.run(now, personaId)
  log.debug('Updated last seen', { personaId })
}

/**
 * Update persona status
 */
export function updateStatus(personaId: string, status: PersonaStatus): void {
  queries.updatePersonaStatus.run(status, personaId)
  log.debug('Updated persona status', { personaId, status })
}

/**
 * Get all active personas (seen in last hour)
 */
export function getActivePersonas(): Persona[] {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const results = queries.getActivePersonas.all(oneHourAgo) as Array<Record<string, unknown>>
  return results.map(mapDbToPersona)
}

/**
 * Get all personas
 */
export function getAllPersonas(): Persona[] {
  const results = queries.getAllPersonas.all() as Array<Record<string, unknown>>
  return results.map(mapDbToPersona)
}

/**
 * Get persona by ID
 */
export function getPersonaById(id: string): Persona | null {
  const result = queries.getPersonaById.get(id) as Record<string, unknown> | null
  return result ? mapDbToPersona(result) : null
}

/**
 * Add XP to a persona
 */
export function addXp(personaId: string, amount: number): void {
  queries.addPersonaXp.run(amount, personaId)

  // Check for level up
  const persona = getPersonaById(personaId)
  if (persona) {
    const newLevel = calculateLevel(persona.totalXp + amount)
    if (newLevel > persona.level) {
      queries.updatePersonaLevel.run(newLevel, personaId)
      log.info('Persona leveled up', { personaId, oldLevel: persona.level, newLevel })
    }
  }
}

/**
 * Calculate level from XP (simple formula)
 */
function calculateLevel(xp: number): number {
  // Each level requires 100 * level XP
  // Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, etc.
  let level = 1
  let xpNeeded = 0

  while (xp >= xpNeeded) {
    xpNeeded += 100 * level
    if (xp >= xpNeeded) {
      level++
    }
  }

  return level
}

/**
 * Map database row to Persona type
 */
function mapDbToPersona(row: Record<string, unknown>): Persona {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    name: row.name as string,
    avatarUrl: row.avatar_url as string | null,
    status: row.status as PersonaStatus,
    totalXp: row.total_xp as number,
    level: row.level as number,
    createdAt: row.created_at as string,
    lastSeenAt: row.last_seen_at as string,
  }
}
