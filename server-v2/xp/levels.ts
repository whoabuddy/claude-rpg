/**
 * Level calculation and progression
 */

import type { LevelInfo } from './types'

/**
 * Level titles based on level range
 */
export const LEVEL_TITLES: Record<string, { min: number; max: number }> = {
  'Apprentice': { min: 1, max: 4 },
  'Journeyman': { min: 5, max: 9 },
  'Expert': { min: 10, max: 14 },
  'Master': { min: 15, max: 19 },
  'Grandmaster': { min: 20, max: 29 },
  'Legend': { min: 30, max: Infinity },
}

/**
 * Calculate XP required for a specific level
 * Formula: 100 * 1.5^(level-1)
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.floor(100 * Math.pow(1.5, level - 2))
}

/**
 * Calculate total XP needed to reach a level
 */
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0

  let total = 0
  for (let l = 2; l <= level; l++) {
    total += xpForLevel(l)
  }
  return total
}

/**
 * Get level info from total XP
 */
export function levelFromTotalXp(totalXp: number): LevelInfo {
  let level = 1
  let xpUsed = 0

  // Find current level
  while (true) {
    const xpNeeded = xpForLevel(level + 1)
    if (xpUsed + xpNeeded > totalXp) {
      break
    }
    xpUsed += xpNeeded
    level++
  }

  const xpIntoLevel = totalXp - xpUsed
  const xpForNextLevel = xpForLevel(level + 1)
  const progressPercent = xpForNextLevel > 0
    ? Math.floor((xpIntoLevel / xpForNextLevel) * 100)
    : 100

  return {
    level,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent,
    title: getTitleForLevel(level),
  }
}

/**
 * Get title for a given level
 */
export function getTitleForLevel(level: number): string {
  for (const [title, range] of Object.entries(LEVEL_TITLES)) {
    if (level >= range.min && level <= range.max) {
      return title
    }
  }
  return 'Legend'
}

/**
 * Calculate XP needed for next level
 */
export function xpToNextLevel(totalXp: number): number {
  const info = levelFromTotalXp(totalXp)
  return info.xpForNextLevel - info.xpIntoLevel
}
