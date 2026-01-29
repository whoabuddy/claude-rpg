/**
 * Persona types
 */

export type PersonaStatus = 'active' | 'idle' | 'offline'

export interface Persona {
  id: string
  sessionId: string
  name: string
  avatarUrl: string | null
  status: PersonaStatus
  totalXp: number
  level: number
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
