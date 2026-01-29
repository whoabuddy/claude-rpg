/**
 * Quest types
 */

export type QuestStatus =
  | 'planned'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'archived'

export type QuestPhaseStatus =
  | 'pending'
  | 'planned'
  | 'executing'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'skipped'

export interface QuestPhase {
  id: string
  name: string
  status: QuestPhaseStatus
  planPath?: string
  startedAt?: string
  completedAt?: string
  retryCount: number
  errorMessage?: string
}

export interface Quest {
  id: string
  projectId: string | null
  title: string
  description: string | null
  status: QuestStatus
  phases: QuestPhase[]
  xpAwarded: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface QuestCreateInput {
  projectId?: string
  title: string
  description?: string
  phases: Array<{
    id: string
    name: string
  }>
}
