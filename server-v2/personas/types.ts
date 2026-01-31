/**
 * Persona types
 */

import type { PersonaTier } from './tiers'

export type PersonaStatus = 'active' | 'idle' | 'offline'

export interface PersonaHealth {
  energy: number      // 0-100, drains on idle, fills on activity
  morale: number      // 0-100, boosts on success, drops on errors
  lastUpdated: string // ISO timestamp
}

export interface Persona {
  id: string
  sessionId: string
  name: string
  avatarUrl: string | null
  status: PersonaStatus
  totalXp: number
  level: number
  tier: PersonaTier
  badges: string[]
  health: PersonaHealth
  createdAt: string
  lastSeenAt: string
}

export interface PersonaWithStats extends Persona {
  stats: {
    toolsUsed: number
    filesEdited: number
    testsRun: number
    commitsCreated: number
    linesChanged: number
  }
}

export type ChallengePeriod = 'daily' | 'weekly'
export type ChallengeStatus = 'active' | 'completed' | 'expired'

export interface ChallengeDefinition {
  id: string
  name: string
  description: string
  period: ChallengePeriod
  target: number
  stat: string
  xpReward: number
}

export interface PersonaChallenge {
  id: string
  personaId: string
  challengeId: string
  period: ChallengePeriod
  status: ChallengeStatus
  progress: number
  target: number
  xpReward: number
  assignedAt: string
  expiresAt: string
  completedAt?: string
}
