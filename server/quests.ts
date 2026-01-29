import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { Quest, QuestPhase, QuestPhaseStatus, QuestEventType, ClaudeEvent, PostToolUseEvent, Companion } from '../shared/types.js'

const QUESTS_FILE = 'quests.json'

// ═══════════════════════════════════════════════════════════════════════════
// Config Loading
// ═══════════════════════════════════════════════════════════════════════════

interface QuestConfig {
  maxRetries: number
}

const DEFAULT_CONFIG: QuestConfig = { maxRetries: 3 }

function loadQuestConfig(): QuestConfig {
  try {
    const configPath = join(process.cwd(), '.planning', 'config.json')
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      maxRetries: typeof parsed.maxRetries === 'number' ? parsed.maxRetries : DEFAULT_CONFIG.maxRetries,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

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

/**
 * Validate that earlier phases are far enough along before allowing a transition.
 * - For planning: previous phase must be at least 'planned' (allows parallel planning)
 * - For executing: all previous phases must be 'completed'
 */
function validatePhaseOrder(quest: Quest, phase: QuestPhase, requiredPriorStatus: 'planned' | 'completed'): boolean {
  const PHASE_PROGRESS: Record<string, number> = {
    pending: 0,
    planned: 2,
    executing: 3,
    retrying: 3, // same as executing (still in progress)
    completed: 5,
    failed: -1, // blocks downstream
  }

  const requiredLevel = PHASE_PROGRESS[requiredPriorStatus]

  for (const p of quest.phases) {
    if (p.order >= phase.order) continue // only check earlier phases
    const level = PHASE_PROGRESS[p.status] ?? 0

    // Failed phases block everything downstream
    if (level === -1) {
      console.warn(`[claude-rpg] Phase order violation: "${phase.name}" blocked — earlier phase "${p.name}" is failed`)
      return false
    }

    if (level < requiredLevel) {
      console.warn(`[claude-rpg] Phase order violation: "${phase.name}" requires earlier phase "${p.name}" to be at least ${requiredPriorStatus} (currently ${p.status})`)
      return false
    }
  }

  return true
}

function handleQuestCreated(quests: Quest[], event: QuestCreatedPayload): Quest {
  // Check if quest already exists (idempotency)
  const existing = quests.find(q => q.id === event.questId)
  if (existing) return existing

  const config = loadQuestConfig()

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
      maxRetries: config.maxRetries,
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

  // Allow planning if previous phases are at least planned (parallel planning OK)
  if (!validatePhaseOrder(quest, phase, 'planned')) return null

  phase.status = 'planned'
  phase.taskCount = event.taskCount
  return quest
}

function handlePhaseExecuting(quests: Quest[], event: PhaseExecutingPayload): Quest | null {
  const quest = quests.find(q => q.id === event.questId)
  if (!quest) return null

  const phase = quest.phases.find(p => p.id === event.phaseId)
  if (!phase) return null

  // Execution requires all earlier phases to be completed
  if (!validatePhaseOrder(quest, phase, 'completed')) return null

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
    phase.retryCount = 0
  } else {
    phase.status = 'failed'
    phase.gaps = event.gaps

    // Auto-pause quest when phase exhausts retries
    if (phase.retryCount >= phase.maxRetries) {
      quest.status = 'paused'
      console.log(`[claude-rpg] Quest "${quest.name}" paused: phase "${phase.name}" failed after ${phase.retryCount} retries`)
    }
  }

  // Check if all phases completed
  const allCompleted = quest.phases.every(p => p.status === 'completed')
  if (allCompleted) {
    quest.status = 'completed'
    quest.completedAt = Date.now()

    // Finalize and persist summary
    computeQuestSummary(quest)
    finalizeQuestSummary(quest.id)
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

  // Finalize and persist summary
  computeQuestSummary(quest)
  finalizeQuestSummary(quest.id)

  return quest
}

// ═══════════════════════════════════════════════════════════════════════════
// Quest Summary Computation
// ═══════════════════════════════════════════════════════════════════════════

export interface QuestSummary {
  xpEarned: number
  commits: number
  testsRun: number
  toolsUsed: Record<string, number>
}

// In-memory accumulator for quest summaries (not persisted until completion)
const questSummaries = new Map<string, QuestSummary>()

function initQuestSummary(questId: string): QuestSummary {
  const summary: QuestSummary = {
    xpEarned: 0,
    commits: 0,
    testsRun: 0,
    toolsUsed: {},
  }
  questSummaries.set(questId, summary)
  return summary
}

export function getQuestSummary(questId: string): QuestSummary {
  return questSummaries.get(questId) || initQuestSummary(questId)
}

export function updateQuestSummary(questId: string, updates: Partial<QuestSummary>): QuestSummary {
  const summary = getQuestSummary(questId)

  if (updates.xpEarned !== undefined) {
    summary.xpEarned += updates.xpEarned
  }
  if (updates.commits !== undefined) {
    summary.commits += updates.commits
  }
  if (updates.testsRun !== undefined) {
    summary.testsRun += updates.testsRun
  }
  if (updates.toolsUsed) {
    for (const [tool, count] of Object.entries(updates.toolsUsed)) {
      summary.toolsUsed[tool] = (summary.toolsUsed[tool] || 0) + count
    }
  }

  questSummaries.set(questId, summary)
  return summary
}

export function computeQuestSummary(quest: Quest): Quest {
  const summary = getQuestSummary(quest.id)

  // Attach summary to quest object
  quest.xpEarned = summary.xpEarned
  quest.commits = summary.commits
  quest.testsRun = summary.testsRun
  quest.toolsUsed = { ...summary.toolsUsed }

  return quest
}

export function finalizeQuestSummary(questId: string): void {
  // Remove from in-memory tracker after quest completes (summary persisted to quest object)
  questSummaries.delete(questId)
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

// ═══════════════════════════════════════════════════════════════════════════
// Quest Archive (retroactive stats from event history)
// ═══════════════════════════════════════════════════════════════════════════

// XP rewards (duplicated from xp.ts to avoid circular dependency)
const TOOL_XP: Record<string, number> = {
  Read: 1,
  Edit: 3,
  Write: 5,
  Bash: 2,
  Grep: 1,
  Glob: 1,
  Task: 5,
  WebFetch: 2,
  WebSearch: 2,
  TodoWrite: 1,
  AskUserQuestion: 1,
  default: 1,
}

function getToolXP(tool: string): number {
  return TOOL_XP[tool] ?? TOOL_XP.default
}

/**
 * Compute quest stats from event history (for manual completion without proper workflow).
 * Filters events by quest time window and associated repos.
 */
function computeStatsFromEvents(events: ClaudeEvent[]): QuestSummary {
  let commits = 0
  let testsRun = 0
  let xpEarned = 0
  const toolsUsed: Record<string, number> = {}

  for (const e of events) {
    if (e.type === 'post_tool_use') {
      const postEvent = e as PostToolUseEvent
      const tool = postEvent.tool

      toolsUsed[tool] = (toolsUsed[tool] || 0) + 1
      xpEarned += getToolXP(tool)

      // Check for git commit
      const cmd = ((postEvent as PostToolUseEvent & { toolInput?: { command?: string } }).toolInput?.command || '').toLowerCase()
      if (cmd.includes('git commit')) commits++
      if (/\btest\b|vitest|pytest|jest|npm test|pnpm test/.test(cmd)) testsRun++
    } else if (e.type === 'pre_tool_use') {
      // Also count tool XP from pre_tool_use (matches xp.ts logic)
      const preEvent = e as { tool: string }
      xpEarned += getToolXP(preEvent.tool)
    }
  }

  return { xpEarned, commits, testsRun, toolsUsed }
}

/**
 * Archive a quest by computing stats from event history.
 * Used when a quest is manually marked complete without going through proper workflow.
 */
export function archiveQuest(
  quest: Quest,
  events: ClaudeEvent[],
  companions: Companion[]
): Quest {
  // 1. Filter events by quest time window and repos
  const startTime = quest.createdAt
  const endTime = quest.completedAt || Date.now()

  const questEvents = events.filter(e => {
    if (e.timestamp < startTime || e.timestamp > endTime) return false
    // Match any repo in quest.repos by path
    return quest.repos.some(repo => {
      const companion = companions.find(c => c.repo.name === repo)
      return companion && e.cwd?.startsWith(companion.repo.path)
    })
  })

  // 2. Compute stats from filtered events
  const stats = computeStatsFromEvents(questEvents)
  quest.xpEarned = stats.xpEarned
  quest.commits = stats.commits
  quest.testsRun = stats.testsRun
  quest.toolsUsed = stats.toolsUsed

  // 3. Mark incomplete phases as 'skipped'
  for (const phase of quest.phases) {
    if (phase.status !== 'completed' && phase.status !== 'failed') {
      phase.status = 'skipped'
    }
  }

  // 4. Set archived status
  quest.status = 'archived'
  quest.archivedAt = Date.now()
  quest.archiveSource = 'computed'

  return quest
}
