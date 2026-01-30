/**
 * Quest service
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import { eventBus } from '../events'
import type { QuestStatusChangedEvent } from '../events/types'
import { transitionQuest, transitionPhase } from './state-machine'
import type { Quest, QuestPhase, QuestPhaseStatus, QuestStatus, QuestCreateInput } from './types'

const log = createLogger('quest-service')

/**
 * Broadcast quest update via WebSocket
 * Import dynamically to avoid circular dependency
 */
function broadcastQuestUpdate(quest: Quest): void {
  // Dynamic import to avoid circular deps (api -> quests -> api)
  import('../api/broadcast').then(({ broadcast }) => {
    import('../api/handlers').then(({ mapQuestToShared }) => {
      const sharedQuest = mapQuestToShared(quest)
      broadcast({
        type: 'quest_update',
        payload: sharedQuest,
      })
    })
  }).catch((error) => {
    log.error('Failed to broadcast quest update', {
      questId: quest.id,
      error: error instanceof Error ? error.message : String(error),
    })
  })
}

/**
 * Create a new quest
 */
export function createQuest(input: QuestCreateInput): Quest {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  // Build phases with initial status
  const phases: QuestPhase[] = input.phases.map(p => ({
    id: p.id,
    name: p.name,
    status: 'pending' as QuestPhaseStatus,
    retryCount: 0,
  }))

  queries.insertQuest.run(
    id,
    input.projectId || null,
    input.title,
    input.description || null,
    'planned' as QuestStatus,
    JSON.stringify(phases),
    now
  )

  log.info('Created quest', { id, title: input.title, phases: phases.length })

  const quest: Quest = {
    id,
    projectId: input.projectId || null,
    title: input.title,
    description: input.description || null,
    status: 'planned',
    phases,
    xpAwarded: 0,
    createdAt: now,
    startedAt: null,
    completedAt: null,
  }

  // Broadcast to WebSocket clients
  broadcastQuestUpdate(quest)

  return quest
}

/**
 * Get quest by ID
 */
export function getQuestById(id: string): Quest | null {
  const row = queries.getQuestById.get(id) as Record<string, unknown> | null
  return row ? mapDbToQuest(row) : null
}

/**
 * Update quest status
 */
export async function updateQuestStatus(questId: string, newStatus: QuestStatus): Promise<Quest> {
  const quest = getQuestById(questId)
  if (!quest) {
    throw new Error(`Quest not found: ${questId}`)
  }

  // Validate and apply transition
  const validatedStatus = transitionQuest(quest.status, newStatus)

  // Update in database
  queries.updateQuestStatus.run(validatedStatus, questId)

  // Emit event
  await eventBus.emit<QuestStatusChangedEvent>({
    type: 'quest:status_changed',
    questId,
    oldStatus: quest.status,
    newStatus: validatedStatus,
  })

  log.info('Quest status updated', { questId, from: quest.status, to: validatedStatus })

  const updatedQuest = { ...quest, status: validatedStatus }

  // Broadcast to WebSocket clients
  broadcastQuestUpdate(updatedQuest)

  return updatedQuest
}

/**
 * Update phase status within a quest
 */
export async function updatePhaseStatus(
  questId: string,
  phaseId: string,
  newStatus: QuestPhaseStatus
): Promise<Quest> {
  const quest = getQuestById(questId)
  if (!quest) {
    throw new Error(`Quest not found: ${questId}`)
  }

  const phase = quest.phases.find(p => p.id === phaseId)
  if (!phase) {
    throw new Error(`Phase not found: ${phaseId} in quest ${questId}`)
  }

  // Validate and apply transition
  const validatedStatus = transitionPhase(phase.status, newStatus)

  // Update phase in quest
  const now = new Date().toISOString()
  const updatedPhases = quest.phases.map(p => {
    if (p.id === phaseId) {
      return {
        ...p,
        status: validatedStatus,
        startedAt: p.startedAt || (validatedStatus === 'executing' ? now : undefined),
        completedAt: validatedStatus === 'completed' ? now : p.completedAt,
        retryCount: validatedStatus === 'retrying' ? p.retryCount + 1 : p.retryCount,
      }
    }
    return p
  })

  // Update in database
  queries.updateQuestPhases.run(JSON.stringify(updatedPhases), questId)

  log.info('Phase status updated', {
    questId,
    phaseId,
    from: phase.status,
    to: validatedStatus,
  })

  const updatedQuest = { ...quest, phases: updatedPhases }

  // Broadcast to WebSocket clients
  broadcastQuestUpdate(updatedQuest)

  return updatedQuest
}

/**
 * Get all quests with a specific status
 */
export function getQuestsByStatus(status: QuestStatus): Quest[] {
  const rows = queries.getQuestsByStatus.all(status) as Array<Record<string, unknown>>
  return rows.map(mapDbToQuest)
}

/**
 * Get active quests (planned or active)
 */
export function getActiveQuests(): Quest[] {
  const planned = getQuestsByStatus('planned')
  const active = getQuestsByStatus('active')
  return [...active, ...planned]
}

/**
 * Get quests for a project
 */
export function getQuestsByProject(projectId: string): Quest[] {
  const rows = queries.getQuestsByProject.all(projectId) as Array<Record<string, unknown>>
  return rows.map(mapDbToQuest)
}

/**
 * Complete a quest
 */
export async function completeQuest(questId: string, xpAwarded: number): Promise<Quest> {
  const quest = await updateQuestStatus(questId, 'completed')

  const now = new Date().toISOString()
  queries.completeQuest.run(now, xpAwarded, questId)

  log.info('Quest completed', { questId, xpAwarded })

  const completedQuest = { ...quest, status: 'completed' as QuestStatus, xpAwarded, completedAt: now }

  // Broadcast to WebSocket clients
  broadcastQuestUpdate(completedQuest)

  return completedQuest
}

/**
 * Map database row to Quest type
 */
function mapDbToQuest(row: Record<string, unknown>): Quest {
  return {
    id: row.id as string,
    projectId: row.project_id as string | null,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as QuestStatus,
    phases: JSON.parse(row.phases as string) as QuestPhase[],
    xpAwarded: row.xp_awarded as number,
    createdAt: row.created_at as string,
    startedAt: row.started_at as string | null,
    completedAt: row.completed_at as string | null,
  }
}
