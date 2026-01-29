/**
 * Persona service
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import { fetchBitcoinFace, getFallbackAvatarUrl } from './avatar'
import { generateNameFromSessionId, generateUniqueName } from './names'
import { getTierForLevel } from './tiers'
import { checkBadges } from './badges'
import { generatePersonality } from './personality'
import {
  createInitialHealth,
  calculateEnergyDecay,
  applyEnergyGain,
  applyMoraleDelta,
} from './health'
import type { Persona, PersonaStatus, PersonaHealth } from './types'

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

  const tier = getTierForLevel(1)

  return {
    id,
    sessionId,
    name,
    avatarUrl,
    status: 'active',
    totalXp: 0,
    level: 1,
    tier: tier.name,
    badges: [],
    personality: { backstory: null, quirk: null },
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

    // Check for new badges
    const stats = getPersonaStats(personaId)
    const earnedBadges = checkBadges(stats)

    // Update badges if changed
    const currentBadges = new Set(persona.badges)
    const newBadges = earnedBadges.filter((badge) => !currentBadges.has(badge))

    if (newBadges.length > 0) {
      updateBadges(personaId, earnedBadges)
      log.info('Persona earned new badges', { personaId, newBadges })
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
 * Get persona stats from database
 */
function getPersonaStats(personaId: string): Record<string, number> {
  const stats = queries.getStatsByEntity.all('persona', personaId) as Array<Record<string, unknown>>
  const result: Record<string, number> = {}

  for (const stat of stats) {
    const path = stat.stat_path as string
    const value = stat.value as number
    result[path] = value
  }

  return result
}

/**
 * Update badges for a persona
 */
export function updateBadges(personaId: string, badges: string[]): void {
  const badgesJson = JSON.stringify(badges)
  queries.updatePersonaBadges.run(badgesJson, personaId)
  log.debug('Updated persona badges', { personaId, badges })
}

/**
 * Update persona health (energy and morale)
 */
export function updateHealth(personaId: string, energyDelta: number, moraleDelta: number): PersonaHealth {
  const current = getHealth(personaId)

  // Apply decay first
  const decayAmount = calculateEnergyDecay(current.lastUpdated)
  let newEnergy = Math.max(0, current.energy - decayAmount)

  // Apply deltas
  newEnergy = applyEnergyGain(newEnergy, energyDelta)
  const newMorale = applyMoraleDelta(current.morale, moraleDelta)

  const now = new Date().toISOString()
  queries.updatePersonaHealth.run(newEnergy, newMorale, now, personaId)

  log.debug('Updated persona health', {
    personaId,
    energyDelta,
    moraleDelta,
    newEnergy,
    newMorale,
  })

  return {
    energy: newEnergy,
    morale: newMorale,
    lastUpdated: now,
  }
}

/**
 * Get current health for a persona
 */
export function getHealth(personaId: string): PersonaHealth {
  const result = queries.getPersonaHealth.get(personaId) as Record<string, unknown> | null

  if (!result) {
    // Persona doesn't have health yet (pre-migration), return default
    const initial = createInitialHealth()
    queries.updatePersonaHealth.run(initial.energy, initial.morale, initial.lastUpdated, personaId)
    return initial
  }

  return {
    energy: result.energy as number,
    morale: result.morale as number,
    lastUpdated: result.health_updated_at as string,
  }
}

/**
 * Decay health for idle persona (called periodically)
 */
export function decayHealth(personaId: string): PersonaHealth {
  const current = getHealth(personaId)
  const decayAmount = calculateEnergyDecay(current.lastUpdated)

  if (decayAmount === 0) {
    return current // No decay yet
  }

  const newEnergy = Math.max(0, current.energy - decayAmount)
  const now = new Date().toISOString()

  queries.updatePersonaHealth.run(newEnergy, current.morale, now, personaId)

  log.debug('Decayed persona health', { personaId, decayAmount, newEnergy })

  return {
    energy: newEnergy,
    morale: current.morale,
    lastUpdated: now,
  }
}

/**
 * Map database row to Persona type
 */
function mapDbToPersona(row: Record<string, unknown>): Persona {
  const level = row.level as number
  const name = row.name as string
  const personaId = row.id as string

  // Get tier from level
  const tier = getTierForLevel(level)

  // Parse badges from JSON
  const badgesJson = row.badges as string
  const badges = badgesJson ? JSON.parse(badgesJson) : []

  // Get stats and generate personality
  const stats = getPersonaStats(personaId)
  const personality = generatePersonality(name, level, stats)

  // Get health
  const health = getHealth(personaId)

  return {
    id: personaId,
    sessionId: row.session_id as string,
    name,
    avatarUrl: row.avatar_url as string | null,
    status: row.status as PersonaStatus,
    totalXp: row.total_xp as number,
    level,
    tier: tier.name,
    badges,
    personality,
    health,
    createdAt: row.created_at as string,
    lastSeenAt: row.last_seen_at as string,
  }
}
