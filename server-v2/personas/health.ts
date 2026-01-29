/**
 * Persona health and morale calculation
 */

import type { PersonaHealth } from './types'

// Health constants
export const MAX_HEALTH = 100
export const MIN_HEALTH = 0

// Energy constants (0-100)
export const ENERGY_DECAY_PER_MINUTE = 0.5
export const ENERGY_GAIN_PROMPT = 10
export const ENERGY_GAIN_TOOL_USE = 2

// Morale constants (0-100)
export const MORALE_GAIN_SUCCESS = 5
export const MORALE_LOSS_ERROR = 10
export const MORALE_GAIN_TEST_PASS = 15
export const MORALE_GAIN_COMMIT = 20

export type HealthLevel = 'critical' | 'low' | 'normal' | 'high'

/**
 * Calculate energy decay based on time elapsed since last update
 */
export function calculateEnergyDecay(lastUpdated: string): number {
  const lastUpdatedTime = new Date(lastUpdated).getTime()
  const now = Date.now()
  const minutesElapsed = (now - lastUpdatedTime) / (1000 * 60)

  return Math.floor(minutesElapsed * ENERGY_DECAY_PER_MINUTE)
}

/**
 * Apply energy gain (clamped to 0-100)
 */
export function applyEnergyGain(current: number, amount: number): number {
  return Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, current + amount))
}

/**
 * Apply morale delta (positive or negative, clamped to 0-100)
 */
export function applyMoraleDelta(current: number, delta: number): number {
  return Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, current + delta))
}

/**
 * Get health level category based on value
 */
export function getHealthLevel(value: number): HealthLevel {
  if (value <= 25) return 'critical'
  if (value <= 50) return 'low'
  if (value <= 75) return 'normal'
  return 'high'
}

/**
 * Create initial health state for a new persona
 */
export function createInitialHealth(): PersonaHealth {
  return {
    energy: MAX_HEALTH,
    morale: MAX_HEALTH,
    lastUpdated: new Date().toISOString(),
  }
}
