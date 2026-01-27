import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { Quest, QuestPhase, QuestPhaseStatus, QuestEventType } from '../shared/types.js'

const QUESTS_FILE = 'quests.json'

// ═══════════════════════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════════════════════

export function loadQuests(dataDir: string): Quest[] {
  const filePath = join(dataDir, QUESTS_FILE)
  if (!existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as Quest[]
  } catch {
    console.error('[claude-rpg] Failed to load quests, starting fresh')
    return []
  }
}

export function saveQuests(dataDir: string, quests: Quest[]): void {
  const filePath = join(dataDir, QUESTS_FILE)
  writeFileSync(filePath, JSON.stringify(quests, null, 2))
}

// ═══════════════════════════════════════════════════════════════════════════
// Quest Event Payloads
// ═══════════════════════════════════════════════════════════════════════════

export interface QuestCreatedPayload {
  type: 'quest_created'
  questId: string
  name: string
  description?: string
  phases: Array<{ id: string; name: string; order: number }>
  repos: string[]
}

export interface PhasePlannedPayload {
  type: 'phase_planned'
  questId: string
  phaseId: string
  phaseName: string
  taskCount: number
}

export interface PhaseExecutingPayload {
  type: 'phase_executing'
  questId: string
  phaseId: string
  phaseName: string
}

export interface PhaseVerifiedPayload {
  type: 'phase_verified'
  questId: string
  phaseId: string
  result: 'pass' | 'fail'
  gaps?: string[]
  retryCount?: number
}

export interface PhaseRetryingPayload {
  type: 'phase_retrying'
  questId: string
  phaseId: string
  retryCount: number
  diagnosis?: string
}

export interface QuestCompletedPayload {
  type: 'quest_completed'
  questId: string
  phasesCompleted?: number
  totalRetries?: number
}

export type QuestEventPayload =
  | QuestCreatedPayload
  | PhasePlannedPayload
  | PhaseExecutingPayload
  | PhaseVerifiedPayload
  | PhaseRetryingPayload
  | QuestCompletedPayload

// ═══════════════════════════════════════════════════════════════════════════
// Quest Event Type Guard
// ═══════════════════════════════════════════════════════════════════════════

const QUEST_EVENT_TYPES: Set<string> = new Set([
  'quest_created',
  'phase_planned',
  'phase_executing',
  'phase_verified',
  'phase_retrying',
  'quest_completed',
])

export function isQuestEvent(event: { type: string }): event is QuestEventPayload {
  return QUEST_EVENT_TYPES.has(event.type)
}

// ═══════════════════════════════════════════════════════════════════════════
// State Machine
// ═══════════════════════════════════════════════════════════════════════════

export function processQuestEvent(quests: Quest[], event: QuestEventPayload): Quest | null {
  switch (event.type) {
    case 'quest_created':
      return handleQuestCreated(quests, event)
    case 'phase_planned':
      return handlePhasePlanned(quests, event)
    case 'phase_executing':
      return handlePhaseExecuting(quests, event)
    case 'phase_verified':
      return handlePhaseVerified(quests, event)
    case 'phase_retrying':
      return handlePhaseRetrying(quests, event)
    case 'quest_completed':
      return handleQuestCompleted(quests, event)
    default:
      return null
  }
}

function handleQuestCreated(quests: Quest[], event: QuestCreatedPayload): Quest {
  // Check if quest already exists (idempotency)
  const existing = quests.find(q => q.id === event.questId)
  if (existing) return existing

  const quest: Quest = {
    id: event.questId,
    name: event.name,
    description: event.description || '',
    repos: event.repos || [],
    phases: (event.phases || []).map(p => ({
      id: p.id,
      name: p.name,
      order: p.order,
      status: 'pending' as QuestPhaseStatus,
      retryCount: 0,
      maxRetries: 3,
    })),
    status: 'active',
    createdAt: Date.now(),
  }

  quests.push(quest)
  return quest
}

function handlePhasePlanned(quests: Quest[], event: PhasePlannedPayload): Quest | null {
  const quest = quests.find(q => q.id === event.questId)
  if (!quest) return null

  const phase = quest.phases.find(p => p.id === event.phaseId)
  if (!phase) return null

  phase.status = 'planned'
  phase.taskCount = event.taskCount
  return quest
}

function handlePhaseExecuting(quests: Quest[], event: PhaseExecutingPayload): Quest | null {
  const quest = quests.find(q => q.id === event.questId)
  if (!quest) return null

  const phase = quest.phases.find(p => p.id === event.phaseId)
  if (!phase) return null

  phase.status = 'executing'
  if (!phase.startedAt) {
    phase.startedAt = Date.now()
  }
  return quest
}

function handlePhaseVerified(quests: Quest[], event: PhaseVerifiedPayload): Quest | null {
  const quest = quests.find(q => q.id === event.questId)
  if (!quest) return null

  const phase = quest.phases.find(p => p.id === event.phaseId)
  if (!phase) return null

  phase.verificationResult = event.result
  phase.retryCount = event.retryCount ?? phase.retryCount

  if (event.result === 'pass') {
    phase.status = 'completed'
    phase.completedAt = Date.now()
  } else {
    phase.status = 'failed'
    phase.gaps = event.gaps
  }

  // Check if all phases completed
  const allCompleted = quest.phases.every(p => p.status === 'completed')
  if (allCompleted) {
    quest.status = 'completed'
    quest.completedAt = Date.now()
  }

  return quest
}

function handlePhaseRetrying(quests: Quest[], event: PhaseRetryingPayload): Quest | null {
  const quest = quests.find(q => q.id === event.questId)
  if (!quest) return null

  const phase = quest.phases.find(p => p.id === event.phaseId)
  if (!phase) return null

  phase.status = 'retrying'
  phase.retryCount = event.retryCount
  return quest
}

function handleQuestCompleted(quests: Quest[], event: QuestCompletedPayload): Quest | null {
  const quest = quests.find(q => q.id === event.questId)
  if (!quest) return null

  quest.status = 'completed'
  quest.completedAt = Date.now()
  return quest
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

export function getActiveQuests(quests: Quest[]): Quest[] {
  return quests.filter(q => q.status === 'active')
}

export function getQuestForRepo(quests: Quest[], repoName: string): Quest | undefined {
  return quests.find(q => q.status === 'active' && q.repos.includes(repoName))
}

export function getCurrentPhase(quest: Quest): QuestPhase | undefined {
  // Return the first non-completed phase
  return quest.phases.find(p => p.status !== 'completed')
}
