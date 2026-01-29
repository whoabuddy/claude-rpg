/**
 * Tier system for personas based on level progression
 */

export type PersonaTier = 'novice' | 'apprentice' | 'journeyman' | 'expert' | 'master'

export interface TierDefinition {
  name: PersonaTier
  displayName: string
  minLevel: number
  maxLevel: number
  color: string
}

export const TIERS: TierDefinition[] = [
  {
    name: 'novice',
    displayName: 'Novice',
    minLevel: 1,
    maxLevel: 4,
    color: '#9CA3AF', // gray-400
  },
  {
    name: 'apprentice',
    displayName: 'Apprentice',
    minLevel: 5,
    maxLevel: 9,
    color: '#3B82F6', // blue-500
  },
  {
    name: 'journeyman',
    displayName: 'Journeyman',
    minLevel: 10,
    maxLevel: 14,
    color: '#8B5CF6', // violet-500
  },
  {
    name: 'expert',
    displayName: 'Expert',
    minLevel: 15,
    maxLevel: 19,
    color: '#F59E0B', // amber-500
  },
  {
    name: 'master',
    displayName: 'Master',
    minLevel: 20,
    maxLevel: Infinity,
    color: '#EF4444', // red-500
  },
]

export function getTierForLevel(level: number): TierDefinition {
  const tier = TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel)
  if (!tier) {
    throw new Error(`No tier found for level ${level}`)
  }
  return tier
}

export function getNextTier(currentTier: PersonaTier): TierDefinition | null {
  const currentIndex = TIERS.findIndex((t) => t.name === currentTier)
  if (currentIndex === -1 || currentIndex === TIERS.length - 1) {
    return null
  }
  return TIERS[currentIndex + 1]
}
