/**
 * Session types
 */

export type SessionStatus = 'idle' | 'typing' | 'working' | 'waiting' | 'error'

export interface ClaudeSession {
  id: string
  paneId: string
  personaId: string | null
  projectId: string | null
  status: SessionStatus
  statusSource: 'hook' | 'terminal' | 'reconciler'
  statusChangedAt: string
  lastActivityAt: string
  terminalContent?: string
  terminalConfidence?: number
}

export interface SessionUpdate {
  status: SessionStatus
  source: 'hook' | 'terminal' | 'reconciler'
  reason?: string
}
