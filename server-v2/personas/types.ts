/**
 * Persona types
 */

import type { PersonaTier } from './tiers'

export type PersonaStatus = 'active' | 'idle' | 'offline'

export interface PersonaPersonality {
  backstory: string | null
  quirk: string | null
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
  personality: PersonaPersonality
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
