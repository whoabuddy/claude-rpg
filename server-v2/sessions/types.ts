/**
 * Session types
 */

export type SessionStatus = 'idle' | 'typing' | 'working' | 'waiting' | 'error'

export interface SessionError {
  tool: string
  message?: string
  timestamp: number
}

/**
 * Subagent info for tracking active subagents
 */
export interface SubagentInfo {
  id: string
  description?: string
  startedAt: number
  isCurrentContext?: boolean
}

export interface ClaudeSession {
  id: string
  paneId: string
  personaId: string | null
  projectId: string | null
  status: SessionStatus
  statusSource: 'hook' | 'terminal' | 'reconciler'
  statusChangedAt: string
  lastActivityAt: string
  lastHookUpdateAt?: number // Timestamp of last hook event, for precedence lock
  terminalContent?: string
  terminalConfidence?: number
  lastError?: SessionError
  activeSubagents?: SubagentInfo[] // Running subagents (guard against premature idle)
}

export interface SessionUpdate {
  status: SessionStatus
  source: 'hook' | 'terminal' | 'reconciler'
  reason?: string
}

