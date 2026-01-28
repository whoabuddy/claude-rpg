import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { watch } from 'chokidar'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, statSync, renameSync } from 'fs'
import { unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'
import { DEFAULTS, expandPath } from '../shared/defaults.js'

const execAsync = promisify(exec)

import type {
  ClaudeEvent,
  Companion,
  Quest,
  ServerMessage,
  TmuxWindow,
  TmuxPane,
  TerminalOutput,
  ClaudeSessionInfo,
  PreToolUseEvent,
  TerminalPrompt,
} from '../shared/types.js'
import { parseTerminalForPrompt, hasPromptChanged, parseTokenCount } from './terminal-parser.js'
import { reconcileSessionState } from './state-reconciler.js'
import { processEvent, detectCommandXP, processQuestXP } from './xp.js'
import { findOrCreateCompanion, saveCompanions, loadCompanions, fetchBitcoinFace, getSessionName, sanitizeSvgPaths } from './companions.js'
import { getAllCompetitions, updateStreak } from './competitions.js'
import { checkAchievements, getAchievementDef } from './achievements.js'
import { loadQuests, saveQuests, processQuestEvent, isQuestEvent, type QuestEventPayload, getQuestForRepo, updateQuestSummary, computeQuestSummary } from './quests.js'
import {
  pollTmuxState,
  updateClaudeSession,
  getClaudeSession,
  removeClaudeSession,
  findPaneByTarget,
  findPaneById,
  getSessionCache,
  setSessionCache,
  getActiveSessionNames,
} from './tmux.js'
import { findWindowById } from './utils.js'
import { getControlClient } from './tmux-control.js'
import { sendKeysLiteral, isSafeForLiteral, batchCommands, buildBufferCommands } from './tmux-batch.js'
import { getSystemStats, startDiskMonitoring } from './system-stats.js'

// Maximum panes per window (keeps tmux TUI manageable)
const MAX_PANES_PER_WINDOW = 4
import { isWhisperAvailable, transcribeAudio } from './whisper.js'

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.CLAUDE_RPG_PORT || String(DEFAULTS.SERVER_PORT))
const DATA_DIR = expandPath(process.env.CLAUDE_RPG_DATA_DIR || DEFAULTS.DATA_DIR)
const rpgEnabled = process.env.CLAUDE_RPG_FEATURES !== 'false'
const AUTO_ACCEPT_BYPASS = process.env.CLAUDE_RPG_AUTO_ACCEPT_BYPASS === 'true'
const bypassWarningHandled = new Set<string>()
const EVENTS_FILE = join(DATA_DIR, DEFAULTS.EVENTS_FILE)
const PANES_CACHE_FILE = join(DATA_DIR, 'panes-cache.json')

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// HTTP response helpers
function sendPaneNotFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Pane not found' }))
}

function sendWindowNotFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Window not found' }))
}

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let companions: Companion[] = rpgEnabled ? loadCompanions(DATA_DIR) : []
let quests: Quest[] = rpgEnabled ? loadQuests(DATA_DIR) : []
let windows: TmuxWindow[] = []
const events: ClaudeEvent[] = []
const clients = new Set<WebSocket>()
const seenEventIds = new Set<string>()
const seenQuestEventIds = new Set<string>()

// Tool execution duration tracking (#29)
// Maps toolUseId -> timestamp of pre_tool_use event
const toolStartTimes = new Map<string, number>()

// Token usage tracking per pane (#31)
const paneTokens = new Map<string, { current: number; cumulative: number }>()

// Dev proxy mode - allows production server to forward API/WS to dev backend
let devProxyMode = false
const DEV_BACKEND_PORT = 4012
const DEV_BACKEND = `http://localhost:${DEV_BACKEND_PORT}`

// Polling intervals
const TMUX_POLL_INTERVAL_MS = 250 // 250ms for responsive UI (like webmux)
const TMUX_POLL_INTERVAL_WITH_CONTROL_MS = 2000 // Slower when control mode is active
const TERMINAL_ACTIVE_INTERVAL_MS = 500 // 500ms for active panes
const TERMINAL_IDLE_INTERVAL_MS = 2000 // 2s for idle panes
const PASTE_SETTLE_MS = 100 // Delay after paste before sending Enter
const CONTROL_MODE_BROADCAST_DEBOUNCE_MS = 50 // Debounce streaming output broadcasts

// Control mode state
let controlModeActive = false
let currentPollInterval = TMUX_POLL_INTERVAL_MS

// ═══════════════════════════════════════════════════════════════════════════
// Pane Cache Persistence
// ═══════════════════════════════════════════════════════════════════════════

function loadPanesCache(): void {
  if (!existsSync(PANES_CACHE_FILE)) return

  try {
    const content = readFileSync(PANES_CACHE_FILE, 'utf-8')
    const data = JSON.parse(content)
    if (data.sessions && typeof data.sessions === 'object') {
      const cache = new Map<string, ClaudeSessionInfo>()
      for (const [paneId, session] of Object.entries(data.sessions)) {
        const sessionInfo = session as ClaudeSessionInfo
        // Sanitize any existing cached avatar SVGs to remove malformed path commands
        if (sessionInfo.avatarSvg) {
          sessionInfo.avatarSvg = sanitizeSvgPaths(sessionInfo.avatarSvg)
        }
        cache.set(paneId, sessionInfo)
      }
      setSessionCache(cache)
    }
  } catch (e) {
    console.error('[claude-rpg] Cache load error:', e)
  }
}

/**
 * Re-fetch missing avatars after cache restore
 * (#90: Issue 1 - Avatars missing after server restart)
 */
async function refetchMissingAvatars(): Promise<void> {
  const cache = getSessionCache()
  const sessionsToRefetch: Array<{ paneId: string; session: ClaudeSessionInfo }> = []

  // Identify sessions missing avatars
  for (const [paneId, session] of cache) {
    if (!session.avatarSvg) {
      sessionsToRefetch.push({ paneId, session })
    }
  }

  if (sessionsToRefetch.length === 0) {
    return
  }

  console.log(`[claude-rpg] Re-fetching ${sessionsToRefetch.length} missing avatar(s)...`)

  // Fetch avatars concurrently
  const results = await Promise.allSettled(
    sessionsToRefetch.map(async ({ paneId, session }) => {
      const svg = await fetchBitcoinFace(session.id)
      if (svg) {
        session.avatarSvg = svg
        updateClaudeSession(paneId, { avatarSvg: svg })
        console.log(`[claude-rpg] Restored avatar for ${session.name} (${session.id.slice(0, 8)})`)
      } else {
        console.error(`[claude-rpg] Failed to fetch avatar for ${session.name} (${session.id.slice(0, 8)})`)
      }
    })
  )

  // Count failures
  const failures = results.filter(r => r.status === 'rejected').length
  if (failures > 0) {
    console.error(`[claude-rpg] ${failures} avatar fetch(es) failed`)
  }

  // Save updated cache
  savePanesCache()
}

function savePanesCache(): void {
  const tmpFile = PANES_CACHE_FILE + '.tmp'
  try {
    const cache = getSessionCache()
    const sessions: Record<string, ClaudeSessionInfo> = {}
    for (const [paneId, session] of cache) {
      sessions[paneId] = session
    }
    writeFileSync(tmpFile, JSON.stringify({ sessions }, null, 2))
    renameSync(tmpFile, PANES_CACHE_FILE)
  } catch (e) {
    console.error('[claude-rpg] Cache save error:', e)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Broadcasting with Backpressure
// ═══════════════════════════════════════════════════════════════════════════

// Flow control thresholds (bytes)
const WS_HIGH_WATER_MARK = 64 * 1024   // 64KB - pause sending
const WS_LOW_WATER_MARK = 16 * 1024    // 16KB - resume sending

// Track paused state per client
const pausedClients = new WeakSet<WebSocket>()

// Message priority levels
type MessagePriority = 'high' | 'normal' | 'low'

/**
 * Get priority for a message type
 * - High: always send (critical state updates)
 * - Normal: send unless paused (important updates)
 * - Low: skip if paused (high-frequency updates)
 */
function getMessagePriority(type: ServerMessage['type']): MessagePriority {
  switch (type) {
    case 'pane_update':
    case 'pane_removed':
    case 'pane_error':
      return 'high'
    case 'windows':
    case 'companion_update':
    case 'companions':
    case 'competitions':
    case 'xp_gain':
    case 'connected':
    case 'history':
      return 'normal'
    case 'terminal_output':
      return 'normal'
    case 'event':
      return 'low'
    default:
      return 'normal'
  }
}

/**
 * Broadcast message to all connected clients with backpressure handling
 */
function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message)
  const priority = getMessagePriority(message.type)

  for (const client of clients) {
    if (client.readyState !== WebSocket.OPEN) continue

    const isPaused = pausedClients.has(client)
    const bufferedAmount = client.bufferedAmount || 0

    // Check if we should pause
    if (bufferedAmount > WS_HIGH_WATER_MARK && !isPaused) {
      pausedClients.add(client)
      // Schedule check to resume
      scheduleResumeCheck(client)
    }

    // Apply priority rules
    if (isPaused) {
      // High priority: always send
      // Normal priority: skip (let buffer drain)
      // Low priority: skip (high-frequency, can miss)
      if (priority !== 'high') continue
    }

    client.send(data)
  }
}

/**
 * Schedule periodic check to resume a paused client
 */
function scheduleResumeCheck(client: WebSocket) {
  const checkInterval = 100 // 100ms

  const check = () => {
    if (client.readyState !== WebSocket.OPEN) {
      pausedClients.delete(client)
      return
    }

    const bufferedAmount = client.bufferedAmount || 0
    if (bufferedAmount < WS_LOW_WATER_MARK) {
      pausedClients.delete(client)
      return
    }

    // Still above threshold, check again
    setTimeout(check, checkInterval)
  }

  setTimeout(check, checkInterval)
}

// ═══════════════════════════════════════════════════════════════════════════
// Tmux Polling with Change Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clean up all ephemeral state for a removed/exited pane
 */
function cleanupPaneState(paneId: string): void {
  consecutiveNoChange.delete(paneId)
  lastContentChange.delete(paneId)
  lastTerminalContent.delete(paneId)
  lastTypingActivity.delete(paneId)
  lastPaneCapture.delete(paneId)
  pendingCaptures.delete(paneId)
}

let previousPaneIds = new Set<string>()
let previousWindowsHash = ''

/**
 * Generate a hash of window/pane structure for change detection.
 * Only includes properties that indicate structural changes.
 */
function hashWindowState(wins: TmuxWindow[]): string {
  // Create a minimal representation for comparison
  const structure = wins.map(w => ({
    id: w.id,
    name: w.windowName,
    panes: w.panes.map(p => ({
      id: p.id,
      type: p.process.type,
      cmd: p.process.command,
      status: p.process.claudeSession?.status,
      tool: p.process.claudeSession?.currentTool,
      hasQuestion: !!p.process.claudeSession?.pendingQuestion,
      hasTerminalPrompt: !!p.process.claudeSession?.terminalPrompt,
      hasError: !!p.process.claudeSession?.lastError,
    })),
  }))
  return JSON.stringify(structure)
}

async function pollTmux(): Promise<void> {
  const newWindows = await pollTmuxState()

  // Detect removed panes
  const currentPaneIds = new Set<string>()
  for (const window of newWindows) {
    for (const pane of window.panes) {
      currentPaneIds.add(pane.id)
    }
  }

  // Broadcast pane_removed for each removed pane
  let hasRemovals = false
  for (const paneId of previousPaneIds) {
    if (!currentPaneIds.has(paneId)) {
      hasRemovals = true
      removeClaudeSession(paneId)
      cleanupPaneState(paneId)
      broadcast({ type: 'pane_removed', payload: { paneId } })
    }
  }

  previousPaneIds = currentPaneIds
  windows = newWindows

  // Check if state actually changed before broadcasting
  const currentHash = hashWindowState(newWindows)
  if (currentHash === previousWindowsHash && !hasRemovals) {
    // No changes - skip broadcast to reduce WebSocket traffic
    return
  }
  previousWindowsHash = currentHash

  // Broadcast windows update only when changed
  broadcast({ type: 'windows', payload: windows })
}

// Start tmux polling with dynamic interval
// Uses slower polling when control mode is active (streaming handles output)
function schedulePoll(): void {
  setTimeout(async () => {
    await pollTmux().catch(e => console.error('[claude-rpg] Poll error:', e))
    schedulePoll()
  }, currentPollInterval)
}
schedulePoll()

// ═══════════════════════════════════════════════════════════════════════════
// Event Normalization (Claude Code hooks → internal format)
// ═══════════════════════════════════════════════════════════════════════════

// Hook event type with known fields
interface RawHookEvent {
  hook_event_name?: string
  hookType?: string
  session_id?: string
  sessionId?: string
  cwd?: string
  timestamp?: number
  tmuxTarget?: string
  paneId?: string
  tool_name?: string
  tool_use_id?: string
  tool_input?: Record<string, unknown>
  tool_response?: Record<string, unknown>
  prompt?: string
  message?: string
  source?: string
}

// Map hook names to internal event types
const HOOK_TYPE_MAP: Record<string, ClaudeEvent['type']> = {
  PreToolUse: 'pre_tool_use',
  PostToolUse: 'post_tool_use',
  Stop: 'stop',
  SubagentStop: 'subagent_stop',
  UserPromptSubmit: 'user_prompt_submit',
  Notification: 'notification',
  SessionStart: 'session_start',
  SessionEnd: 'session_end',
}

function normalizeEvent(raw: RawHookEvent): ClaudeEvent & { paneId?: string } {
  const hookName = raw.hook_event_name || raw.hookType || ''
  const type = HOOK_TYPE_MAP[hookName] || 'pre_tool_use'

  // Common fields for all events
  const base = {
    sessionId: raw.session_id || raw.sessionId || '',
    cwd: raw.cwd || '',
    timestamp: raw.timestamp || Date.now(),
    tmuxTarget: raw.tmuxTarget,
    paneId: raw.paneId,
  }

  switch (type) {
    case 'pre_tool_use':
      return {
        ...base,
        type: 'pre_tool_use',
        tool: raw.tool_name || '',
        toolUseId: raw.tool_use_id || '',
        toolInput: raw.tool_input,
      }

    case 'post_tool_use': {
      const success = raw.tool_response ? !raw.tool_response.error : true
      return {
        ...base,
        type: 'post_tool_use',
        tool: raw.tool_name || '',
        toolUseId: raw.tool_use_id || '',
        success,
        toolResponse: raw.tool_response,
        toolInput: raw.tool_input,
      }
    }

    case 'user_prompt_submit':
      return { ...base, type: 'user_prompt_submit', prompt: raw.prompt || '' }

    case 'notification':
      return { ...base, type: 'notification', message: raw.message || '' }

    case 'stop':
      return { ...base, type: 'stop' }

    case 'subagent_stop':
      return { ...base, type: 'subagent_stop' }

    case 'session_start':
      return { ...base, type: 'session_start', source: raw.source }

    case 'session_end':
      return { ...base, type: 'session_end' }

    default:
      // Fallback to pre_tool_use for unknown types
      return {
        ...base,
        type: 'pre_tool_use',
        tool: raw.tool_name || 'unknown',
        toolUseId: raw.tool_use_id || '',
        toolInput: raw.tool_input,
      }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Quest Event Processing
// ═══════════════════════════════════════════════════════════════════════════

function handleQuestEvent(event: QuestEventPayload) {
  if (!rpgEnabled) return

  // Deduplicate quest events (5-second window)
  const coarseTime = Math.floor(Date.now() / 5000)
  const phaseIdPart = 'phaseId' in event ? (event as { phaseId: string }).phaseId : ''
  const questEventKey = `${event.type}-${'questId' in event ? (event as { questId: string }).questId : ''}-${phaseIdPart}-${coarseTime}`
  if (seenQuestEventIds.has(questEventKey)) {
    console.log(`[claude-rpg] Duplicate quest event skipped: ${event.type}`)
    return
  }
  seenQuestEventIds.add(questEventKey)

  // Keep bounded (quest events are low volume)
  if (seenQuestEventIds.size > 200) {
    const arr = Array.from(seenQuestEventIds)
    arr.slice(0, 100).forEach(id => seenQuestEventIds.delete(id))
  }

  const updatedQuest = processQuestEvent(quests, event)
  if (!updatedQuest) {
    console.log(`[claude-rpg] Quest event ${event.type} had no effect (quest not found?)`)
    return
  }

  // Award quest XP to companions for repos involved in this quest
  if (updatedQuest.repos.length > 0) {
    for (const repoName of updatedQuest.repos) {
      const companion = companions.find(c => c.name === repoName || c.repo.name === repoName)
      if (companion) {
        // Ensure quests stats exist
        if (!companion.stats.quests) {
          companion.stats.quests = { created: 0, phasesCompleted: 0, questsCompleted: 0, totalRetries: 0 }
        }

        const xpGain = processQuestXP(companion, event)
        if (xpGain) {
          // Track XP in quest summary
          updateQuestSummary(updatedQuest.id, { xpEarned: xpGain.amount })

          saveCompanions(DATA_DIR, companions)
          broadcast({ type: 'companion_update', payload: companion } as ServerMessage)
          broadcast({ type: 'xp_gain', payload: xpGain } as ServerMessage)

          // Also broadcast quest-specific XP notification
          const phaseId = 'phaseId' in event ? (event as { phaseId: string }).phaseId : ''
          broadcast({
            type: 'quest_xp',
            payload: { questId: updatedQuest.id, phaseId, xp: xpGain.amount, reason: xpGain.description }
          } as ServerMessage)
        }
      } else {
        console.warn(`[claude-rpg] Quest XP: companion not found for repo "${repoName}", XP not awarded for ${event.type}`)
      }
    }
  }

  // Compute and attach summary before broadcasting
  computeQuestSummary(updatedQuest)

  // Save quests to disk
  saveQuests(DATA_DIR, quests)

  // Broadcast quest update to all clients with computed summary
  broadcast({ type: 'quest_update', payload: updatedQuest } as ServerMessage)

  console.log(`[claude-rpg] Quest event: ${event.type} for quest "${updatedQuest.name}"`)
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Processing
// ═══════════════════════════════════════════════════════════════════════════

async function handleEvent(rawEvent: RawHookEvent) {
  const event = normalizeEvent(rawEvent)
  const eventId = `${event.sessionId}-${event.timestamp}-${event.type}`
  if (seenEventIds.has(eventId)) return
  seenEventIds.add(eventId)

  // Keep seenEventIds bounded
  if (seenEventIds.size > DEFAULTS.MAX_EVENTS * 2) {
    const arr = Array.from(seenEventIds)
    arr.slice(0, DEFAULTS.MAX_EVENTS).forEach(id => seenEventIds.delete(id))
  }

  // Find pane by paneId or tmuxTarget
  let pane: TmuxPane | undefined
  if (event.paneId) {
    pane = findPaneById(windows, event.paneId)
  }
  if (!pane && event.tmuxTarget) {
    pane = findPaneByTarget(windows, event.tmuxTarget)
  }

  // Update Claude session in pane
  if (pane && event.sessionId) {
    let sessionInfo = getClaudeSession(pane.id)

    if (!sessionInfo) {
      // Create new Claude session (avoid name collisions with active sessions)
      const name = getSessionName(event.sessionId, getActiveSessionNames())
      sessionInfo = updateClaudeSession(pane.id, {
        id: event.sessionId,
        name,
        status: 'idle',
      })

      // Fetch Bitcoin face in background
      if (sessionInfo) {
        fetchBitcoinFace(event.sessionId).then(svg => {
          if (svg) {
            updateClaudeSession(pane!.id, { avatarSvg: svg })
            savePanesCache()
            broadcast({ type: 'pane_update', payload: pane! })
          }
        })
      }
    }

    if (sessionInfo) {
      // Update session state based on event type
      if (event.type === 'pre_tool_use') {
        const preEvent = event as PreToolUseEvent
        sessionInfo.status = 'working'
        sessionInfo.lastError = undefined
        sessionInfo.currentTool = preEvent.tool

        // Track tool start time for duration calculation (#29)
        if (preEvent.toolUseId) {
          toolStartTimes.set(preEvent.toolUseId, event.timestamp)
        }

        if (preEvent.toolInput) {
          const filePath = (preEvent.toolInput.file_path || preEvent.toolInput.path) as string | undefined
          sessionInfo.currentFile = filePath

          // Track recent files
          if (filePath && ['Read', 'Edit', 'Write'].includes(preEvent.tool)) {
            const fileName = filePath.split('/').pop() || filePath
            if (!sessionInfo.recentFiles) sessionInfo.recentFiles = []
            sessionInfo.recentFiles = [fileName, ...sessionInfo.recentFiles.filter(f => f !== fileName)].slice(0, 5)
          }
        }

        // Track subagent spawns with details (#32)
        if (preEvent.tool === 'Task' && preEvent.toolInput) {
          const input = preEvent.toolInput as { description?: string; prompt?: string }
          if (!sessionInfo.activeSubagents) sessionInfo.activeSubagents = []
          sessionInfo.activeSubagents.push({
            id: preEvent.toolUseId,
            description: input.description || 'Subagent',
            prompt: input.prompt ? input.prompt.slice(0, 100) : undefined,
            startedAt: event.timestamp,
            lastActivity: event.timestamp,
            isCurrentContext: true,
          })
        } else if (preEvent.tool === 'Task') {
          if (!sessionInfo.activeSubagents) sessionInfo.activeSubagents = []
          sessionInfo.activeSubagents.push({
            id: preEvent.toolUseId,
            description: 'Subagent',
            startedAt: event.timestamp,
            lastActivity: event.timestamp,
            isCurrentContext: true,
          })
        }

        // Detect AskUserQuestion
        if (preEvent.tool === 'AskUserQuestion' && preEvent.toolInput) {
          sessionInfo.status = 'waiting'
          const input = preEvent.toolInput as Record<string, unknown>
          const rawQuestions = input.questions as Array<{
            question: string
            header?: string
            options?: Array<{ label: string; description?: string }>
            multiSelect?: boolean
          }> | undefined

          if (rawQuestions && rawQuestions.length > 0) {
            // Map all questions to our Question type
            const questions = rawQuestions.map(q => ({
              question: q.question,
              header: q.header,
              options: q.options || [],
              multiSelect: q.multiSelect || false,
            }))

            sessionInfo.pendingQuestion = {
              questions,
              currentIndex: 0,
              toolUseId: preEvent.toolUseId,
              timestamp: event.timestamp,
            }
          }
        }

        // Detect ExitPlanMode (waiting for plan approval)
        if (preEvent.tool === 'ExitPlanMode') {
          sessionInfo.status = 'waiting'

          // Default TUI options for plan approval
          // NOTE: These are fallback defaults that approximate Claude Code's TUI options.
          // Update if Claude Code's plan approval flow changes.
          const defaultPlanOptions = [
            { label: 'Yes, clear context and manually bypass permission', description: 'Approve and reset context, bypass permissions manually' },
            { label: 'Yes, and manually approve edits', description: 'Approve but manually review each edit' },
            { label: 'Yes, and bypass permissions', description: 'Approve and auto-bypass permission prompts' },
            { label: 'Yes, manually approve edits', description: 'Approve with manual edit approval' },
          ]

          // Try to read options from tool input if available
          let options = defaultPlanOptions
          if (preEvent.toolInput) {
            const input = preEvent.toolInput as Record<string, unknown>
            if (input.allowedPrompts && Array.isArray(input.allowedPrompts)) {
              // Extract prompt-based options if provided
              const prompts = input.allowedPrompts as Array<{ tool: string; prompt: string }>
              if (prompts.length > 0) {
                options = prompts.map(p => ({
                  label: p.prompt,
                  description: `Allow ${p.tool}: ${p.prompt}`,
                }))
              }
            }
          }

          const planQuestion = {
            question: 'Plan complete - waiting for approval',
            options,
            multiSelect: false,
          }

          sessionInfo.pendingQuestion = {
            questions: [planQuestion],
            currentIndex: 0,
            toolUseId: preEvent.toolUseId,
            timestamp: event.timestamp,
          }
        }

        // Detect EnterPlanMode
        if (preEvent.tool === 'EnterPlanMode') {
          sessionInfo.status = 'working'
          sessionInfo.currentTool = 'Planning'
        }
      } else if (event.type === 'post_tool_use') {
        const postEvent = event as import('../shared/types.js').PostToolUseEvent

        // Calculate tool execution duration (#29)
        if (postEvent.toolUseId) {
          const startTime = toolStartTimes.get(postEvent.toolUseId)
          if (startTime) {
            postEvent.duration = event.timestamp - startTime
            toolStartTimes.delete(postEvent.toolUseId)
            sessionInfo.lastToolDuration = postEvent.duration
          }
        }

        sessionInfo.currentTool = undefined
        sessionInfo.currentFile = undefined

        if (!postEvent.success) {
          sessionInfo.status = 'error'
          sessionInfo.lastError = {
            tool: postEvent.tool,
            message: typeof postEvent.toolResponse === 'object' && postEvent.toolResponse !== null
              ? (postEvent.toolResponse as Record<string, unknown>).error as string
              : undefined,
            timestamp: event.timestamp,
          }
        } else if (sessionInfo.pendingQuestion) {
          sessionInfo.pendingQuestion = undefined
          sessionInfo.status = 'working'
        }
      } else if (event.type === 'stop') {
        // Guard: if subagents are still running, this stop is likely a subagent
        // echoing as a parent stop event — keep working
        if (sessionInfo.activeSubagents && sessionInfo.activeSubagents.length > 0) {
          console.log(`[claude-rpg] Ignoring stop event — ${sessionInfo.activeSubagents.length} subagent(s) still active`)
          // Timeout: force clear activeSubagents if no subagent_stop within 5s
          setTimeout(() => {
            const session = getClaudeSession(pane.id)
            if (session && session.activeSubagents && session.activeSubagents.length > 0) {
              console.warn(`[claude-rpg] Timeout: forcing clear of ${session.activeSubagents.length} orphaned subagent(s)`)
              session.activeSubagents = []
              session.status = 'idle'
              updateClaudeSession(pane.id, session)
              broadcast({ type: 'pane_update', payload: pane })
            }
          }, 5000)
        } else {
          sessionInfo.status = 'idle'
          sessionInfo.currentTool = undefined
          sessionInfo.currentFile = undefined
          sessionInfo.pendingQuestion = undefined
          // Clean up any orphaned tool start times for this session
          // (post events may have been missed)
        }
      } else if (event.type === 'user_prompt_submit') {
        sessionInfo.status = 'working'
        // Don't clear pendingQuestion here - multi-question flows need it
        // It gets cleared on post_tool_use when AskUserQuestion completes
        const promptEvent = event as import('../shared/types.js').UserPromptSubmitEvent
        if (promptEvent.prompt) {
          sessionInfo.lastPrompt = promptEvent.prompt.length > 100
            ? promptEvent.prompt.slice(0, 100) + '...'
            : promptEvent.prompt
        }
      } else if (event.type === 'notification') {
        // Notification may indicate permission prompts or other waiting states
        // Guard: never downgrade from 'working' — subagent completion notifications
        // should not change the parent session's status
        const notifEvent = event as import('../shared/types.js').NotificationEvent
        if (notifEvent.message && sessionInfo.status !== 'working') {
          if (notifEvent.message.includes('permission') || notifEvent.message.includes('waiting')) {
            sessionInfo.status = 'waiting'
          }
        }
      } else if (event.type === 'subagent_stop') {
        // Subagent finished - remove from list, main agent continues working (#32)
        if (sessionInfo.activeSubagents && sessionInfo.activeSubagents.length > 0) {
          // Try to match by toolUseId if available
          const stopEvent = event as import('../shared/types.js').SubagentStopEvent
          const toolUseId = (stopEvent as unknown as Record<string, unknown>).toolUseId as string | undefined
          let idx = toolUseId ? sessionInfo.activeSubagents.findIndex(s => s.id === toolUseId) : -1

          // Fallback 1: Check for stale subagents (active >10 minutes)
          if (idx < 0) {
            const now = event.timestamp
            const staleIdx = sessionInfo.activeSubagents.findIndex(s => now - s.startedAt > 10 * 60 * 1000)
            if (staleIdx >= 0) {
              console.warn(`[claude-rpg] Removing stale subagent (${sessionInfo.activeSubagents[staleIdx].description}) - active >10min`)
              idx = staleIdx
            }
          }

          // Fallback 2: Match by description/prompt prefix if available
          if (idx < 0 && toolUseId) {
            const matchIdx = sessionInfo.activeSubagents.findIndex(s =>
              s.description?.includes(toolUseId.slice(0, 8)) || s.prompt?.includes(toolUseId.slice(0, 8))
            )
            if (matchIdx >= 0) {
              console.warn(`[claude-rpg] Matched subagent by description/prompt prefix: ${sessionInfo.activeSubagents[matchIdx].description}`)
              idx = matchIdx
            }
          }

          // Fallback 3: Remove the oldest subagent
          if (idx < 0) {
            console.warn(`[claude-rpg] Removing oldest subagent (no matching toolUseId)`)
            idx = 0
          }

          if (idx >= 0 && idx < sessionInfo.activeSubagents.length) {
            sessionInfo.activeSubagents.splice(idx, 1)
          }
        }
        // Don't change status - main agent is still running
      } else if (event.type === 'session_start') {
        // New or resumed session - but guard against subagent spawns resetting parent
        const startEvent = event as import('../shared/types.js').SessionStartEvent
        if (sessionInfo.status === 'working' && sessionInfo.activeSubagents && sessionInfo.activeSubagents.length > 0) {
          // Check if this is from subagent context (has isCurrentContext=true)
          const hasCurrentContext = sessionInfo.activeSubagents.some(s => s.isCurrentContext)
          if (hasCurrentContext) {
            // Subagent starting a new session context — don't reset parent
            console.log(`[claude-rpg] Ignoring session_start during active subagent work`)
            // Clear isCurrentContext flag for all subagents
            sessionInfo.activeSubagents.forEach(s => s.isCurrentContext = false)
          } else {
            // No current context flag, treat as real session start
            sessionInfo.status = 'idle'
            sessionInfo.currentTool = undefined
            sessionInfo.currentFile = undefined
            sessionInfo.pendingQuestion = undefined
            sessionInfo.lastError = undefined
            sessionInfo.activeSubagents = []
            // Set lastPrompt to show the command that triggered the new session
            if (startEvent.source === 'clear') {
              sessionInfo.lastPrompt = '/clear'
            }
          }
        } else {
          sessionInfo.status = 'idle'
          sessionInfo.currentTool = undefined
          sessionInfo.currentFile = undefined
          sessionInfo.pendingQuestion = undefined
          sessionInfo.lastError = undefined
          sessionInfo.activeSubagents = []
          // Set lastPrompt to show the command that triggered the new session
          if (startEvent.source === 'clear') {
            sessionInfo.lastPrompt = '/clear'
          }
        }
      } else if (event.type === 'session_end') {
        // Session ended - remove from cache
        removeClaudeSession(pane.id)
      }

      // Update lastActivity since this is actual hook activity
      sessionInfo.lastActivity = event.timestamp

      // Reset adaptive capture backoff so terminal capture resumes at 250ms
      consecutiveNoChange.set(pane.id, 0)
      lastContentChange.set(pane.id, event.timestamp)

      const updatedSession = updateClaudeSession(pane.id, sessionInfo)
      savePanesCache()

      // Update the pane object with fresh session data before broadcasting
      if (updatedSession && pane.process.type === 'claude') {
        pane.process.claudeSession = updatedSession
      }

      broadcast({ type: 'pane_update', payload: pane })
    }
  }

  // Process XP for companion (by CWD → repo) - only when RPG features enabled
  if (rpgEnabled) {
    const companion = findOrCreateCompanion(companions, event.cwd)
    if (companion) {
      const xpGain = processEvent(companion, event)

      // Update streak on activity (only for live events, not historical replay)
      if (!isLoadingHistoricalEvents) {
        const activityDate = new Date(event.timestamp).toISOString().slice(0, 10)
        companion.streak = updateStreak(companion.streak, activityDate)
      }

      // Skip saves/broadcasts during historical event loading (startup perf)
      if (!isLoadingHistoricalEvents) {
        // Check achievements (#37)
        const meta = {
          sessionsCompleted: companion.stats.sessionsCompleted,
          toolsUsedCount: Object.keys(companion.stats.toolsUsed).length,
          totalXP: companion.totalExperience,
        }
        const newAchievements = checkAchievements(companion.stats, companion.streak, companion.achievements, meta)
        for (const achId of newAchievements) {
          companion.achievements.push({ id: achId, unlockedAt: Date.now() })
          const def = getAchievementDef(achId)
          if (def) {
            broadcast({
              type: 'achievement_unlocked',
              payload: {
                companionId: companion.id,
                companionName: companion.name,
                achievementId: achId,
                achievementName: def.name,
                achievementIcon: def.icon,
                rarity: def.rarity,
              },
            } as ServerMessage)
            console.log(`[claude-rpg] Achievement unlocked: ${def.icon} ${def.name} for ${companion.name}`)
          }
        }

        saveCompanions(DATA_DIR, companions)
        broadcast({ type: 'companion_update', payload: companion })
      }

      if (xpGain) {
        // Skip broadcasts during historical loading - O(n²) performance issue
        if (!isLoadingHistoricalEvents) {
          broadcast({ type: 'xp_gain', payload: xpGain })
          // Update competitions leaderboard when XP changes (use full event history)
          broadcast({ type: 'competitions', payload: getAllCompetitions(companions, getAllEventsFromFile()) })
        }

        // Track quest activity for active quests involving this companion's repo
        const activeQuest = getQuestForRepo(quests, companion.repo.name)
        if (activeQuest && activeQuest.status === 'active') {
          // Track tool usage
          if (event.type === 'post_tool_use') {
            const postEvent = event as import('../shared/types.js').PostToolUseEvent
            if (postEvent.tool && postEvent.success) {
              updateQuestSummary(activeQuest.id, {
                toolsUsed: { [postEvent.tool]: 1 },
              })
            }
          }

          // Track git commits
          if (xpGain.type.startsWith('git.commit')) {
            updateQuestSummary(activeQuest.id, { commits: 1 })
          }

          // Track test runs
          if (xpGain.type === 'commands.test' || xpGain.type === 'blockchain.test') {
            updateQuestSummary(activeQuest.id, { testsRun: 1 })
          }

          // Compute and broadcast updated quest summary
          if (!isLoadingHistoricalEvents) {
            computeQuestSummary(activeQuest)
            saveQuests(DATA_DIR, quests)
            broadcast({ type: 'quest_update', payload: activeQuest } as ServerMessage)
          }
        }

        // Also update session stats if we have an active session
        if (pane && pane.process.claudeSession?.stats) {
          const sessionStats = pane.process.claudeSession.stats
          sessionStats.totalXPGained += xpGain.amount
        }
      }
    }

    // Update session stats for all tracked events
    if (pane && pane.process.claudeSession?.stats) {
      const sessionStats = pane.process.claudeSession.stats

      if (event.type === 'pre_tool_use') {
        const preEvent = event as PreToolUseEvent
        sessionStats.toolsUsed[preEvent.tool] = (sessionStats.toolsUsed[preEvent.tool] || 0) + 1
      } else if (event.type === 'user_prompt_submit') {
        sessionStats.promptsReceived++
      } else if (event.type === 'post_tool_use') {
        const postEvent = event as import('../shared/types.js').PostToolUseEvent
        // Check for git/command operations in Bash
        if (postEvent.tool === 'Bash' && postEvent.success && postEvent.toolInput) {
          const command = (postEvent.toolInput as { command?: string }).command || ''
          const cmdDetection = detectCommandXP(command)
          if (cmdDetection) {
            // Update session stats based on command type (dot-path increment)
            const parts = cmdDetection.statKey.split('.')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let obj: any = sessionStats
            for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]]
            obj[parts[parts.length - 1]]++
          }
        }
      }

      // Broadcast pane update to show new stats
      savePanesCache()
      broadcast({ type: 'pane_update', payload: pane })
    }
  }

  // Store event
  events.push(event)
  if (events.length > DEFAULTS.MAX_EVENTS) {
    events.shift()
  }

  // Broadcast event
  broadcast({ type: 'event', payload: event })
}

// ═══════════════════════════════════════════════════════════════════════════
// Terminal Capture
// ═══════════════════════════════════════════════════════════════════════════

const lastTerminalContent = new Map<string, string>()
const lastTypingActivity = new Map<string, number>()
const TYPING_IDLE_TIMEOUT_MS = 3000 // Revert to idle after 3s of no typing

// Adaptive capture scheduling state
const consecutiveNoChange = new Map<string, number>()
const lastContentChange = new Map<string, number>()

// Adaptive capture intervals based on activity state
const CAPTURE_INTERVAL_ACTIVE_MS = 250  // Content changed within 2s
const CAPTURE_INTERVAL_NORMAL_MS = 500  // Claude pane working/waiting
const CAPTURE_INTERVAL_IDLE_MS = 2000   // Non-Claude or stable
const CAPTURE_INTERVAL_BACKOFF_MS = 5000 // 10+ consecutive no-changes

// Thresholds
const ACTIVE_WINDOW_MS = 2000           // Consider "active" if changed within 2s
const BACKOFF_THRESHOLD = 10            // Start backoff after 10 no-changes

/**
 * Calculate capture interval for a pane based on activity state
 */
function getCaptureInterval(paneId: string, isClaudePane: boolean, claudeStatus?: string): number {
  const now = Date.now()
  const noChangeCount = consecutiveNoChange.get(paneId) || 0
  const lastChange = lastContentChange.get(paneId) || 0
  const recentlyActive = (now - lastChange) < ACTIVE_WINDOW_MS

  // Backoff: many consecutive no-changes
  if (noChangeCount >= BACKOFF_THRESHOLD) {
    return CAPTURE_INTERVAL_BACKOFF_MS
  }

  // Active: content changed recently
  if (recentlyActive) {
    return CAPTURE_INTERVAL_ACTIVE_MS
  }

  // Claude panes in working/waiting states get normal interval
  if (isClaudePane && (claudeStatus === 'working' || claudeStatus === 'waiting')) {
    return CAPTURE_INTERVAL_NORMAL_MS
  }

  // Everything else: idle interval
  return CAPTURE_INTERVAL_IDLE_MS
}

/**
 * Capture terminal content from a tmux pane
 * @param target - tmux pane target (e.g., "work:1.0")
 * @param fullScrollback - if true, capture entire scrollback buffer
 * @returns trimmed content or null on error
 */
async function captureTerminal(target: string, fullScrollback = false): Promise<string | null> {
  try {
    // Flags:
    // -p: print to stdout
    // -J: join wrapped lines (cleaner parsing)
    // -S -50: capture last 50 lines (default) or -S - -E - for full scrollback
    const scrollFlags = fullScrollback ? '-S - -E -' : '-S -150'
    const { stdout } = await execAsync(
      `tmux capture-pane -p -J -e -t "${target}" ${scrollFlags}`,
      { timeout: 1000 }
    )
    // Use trimEnd to preserve leading whitespace (important for indentation detection)
    return stdout.trimEnd()
  } catch {
    return null
  }
}

// Track last capture time per pane for rate limiting
const lastPaneCapture = new Map<string, number>()

async function broadcastTerminalUpdates() {
  const now = Date.now()

  for (const window of windows) {
    for (const pane of window.panes) {
      const isClaudePane = pane.process.type === 'claude'
      const claudeStatus = pane.process.claudeSession?.status

      // Adaptive interval based on activity state
      const interval = getCaptureInterval(pane.id, isClaudePane, claudeStatus)

      // Check per-pane rate limiting
      const lastCapture = lastPaneCapture.get(pane.id) || 0
      if (now - lastCapture < interval) continue
      lastPaneCapture.set(pane.id, now)

      const content = await captureTerminal(pane.target)
      if (content === null) continue

      const contentChanged = lastTerminalContent.get(pane.id) !== content
      const lastTyping = lastTypingActivity.get(pane.id) || 0

      // Update adaptive scheduling state
      if (contentChanged) {
        consecutiveNoChange.set(pane.id, 0)
        lastContentChange.set(pane.id, now)
      } else {
        const count = consecutiveNoChange.get(pane.id) || 0
        consecutiveNoChange.set(pane.id, count + 1)
      }

      // Detect typing for NON-Claude panes only
      // Claude pane status is managed by hook events (pre_tool_use, stop, etc.)
      // Terminal content changes (from /clear, /help, etc.) should not affect Claude status
      if (contentChanged) {
        lastTypingActivity.set(pane.id, now)

        // Only set typing flag for non-Claude panes
        if (!isClaudePane && !pane.process.typing) {
          pane.process.typing = true
          broadcast({ type: 'pane_update', payload: pane })
        }
      } else if (!isClaudePane && pane.process.typing && now - lastTyping > TYPING_IDLE_TIMEOUT_MS) {
        // No changes for a while and was typing → clear typing flag (non-Claude only)
        pane.process.typing = false
        broadcast({ type: 'pane_update', payload: pane })
      }

      // Auto-accept bypass warning (#34)
      if (AUTO_ACCEPT_BYPASS && isClaudePane && contentChanged) {
        const paneKey = `${pane.id}-bypass`
        if (!bypassWarningHandled.has(paneKey)) {
          const cleaned = content.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
          if (cleaned.includes('--dangerously-skip-permissions') ||
              cleaned.includes('bypass permission checks')) {
            // Send option "2" to accept the warning
            execAsync(`tmux send-keys -t "${pane.target}" 2`).catch(() => {})
            bypassWarningHandled.add(paneKey)
            console.log(`[claude-rpg] Auto-accepted bypass warning for pane ${pane.id}`)
          }
        }
      }

      // Terminal-based prompt detection for Claude panes
      // This is the source of truth for prompt state
      if (isClaudePane && pane.process.claudeSession) {
        processClaudePaneContent(pane, content)

        // Parse token usage from terminal output (#31)
        if (contentChanged) {
          const tokenCount = parseTokenCount(content)
          if (tokenCount !== null) {
            const existing = paneTokens.get(pane.id) || { current: 0, cumulative: 0 }

            // If new count is lower than current, a new conversation started
            // Add the previous count to cumulative
            if (tokenCount < existing.current) {
              existing.cumulative += existing.current
            }
            existing.current = tokenCount
            paneTokens.set(pane.id, existing)

            const updated = updateClaudeSession(pane.id, { tokens: { ...existing } })
            if (updated && pane.process.claudeSession) {
              pane.process.claudeSession = updated
              savePanesCache()
              broadcast({ type: 'pane_update', payload: pane })
            }
          }
        }
      }

      // Only broadcast terminal content if changed
      if (!contentChanged) continue
      lastTerminalContent.set(pane.id, content)

      // Update pane with terminal content
      pane.terminalContent = content

      const output: TerminalOutput = {
        paneId: pane.id,
        target: pane.target,
        content,
        timestamp: now,
      }

      broadcast({ type: 'terminal_output', payload: output })
    }
  }
}

// Capture terminal output every 500ms (rate limiting handled per-pane)
setInterval(broadcastTerminalUpdates, 500)

// Independent reconciliation timer - catches stuck states even when adaptive polling is in backoff
setInterval(() => {
  for (const window of windows) {
    for (const pane of window.panes) {
      if (pane.process.type !== 'claude' || !pane.process.claudeSession) continue
      const status = pane.process.claudeSession.status
      if (status !== 'working' && status !== 'waiting' && status !== 'error') continue

      // Use cached terminal content for reconciliation
      const cachedContent = lastTerminalContent.get(pane.id)
      if (cachedContent) {
        processClaudePaneContent(pane, cachedContent)
      }
    }
  }
}, 2500)

// Clean stale tool start times every 60s (#29)
// Tools that never got a post_tool_use event (e.g., crash, timeout)
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000
  for (const [id, timestamp] of toolStartTimes) {
    if (timestamp < cutoff) toolStartTimes.delete(id)
  }
}, 60_000)

// ═══════════════════════════════════════════════════════════════════════════
// Safe Tmux Send Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Map known tmux errors to user-friendly messages */
function sanitizeTmuxError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('no pane') || msg.includes('can\'t find pane')) return 'Pane no longer exists'
  if (msg.includes('no session') || msg.includes('session not found')) return 'Session not found'
  if (msg.includes('no window') || msg.includes('window not found')) return 'Window not found'
  if (msg.includes('server not found') || msg.includes('no server')) return 'Tmux server not running'
  return 'Failed to send input to pane'
}

/** Send keys to a tmux target, returning success/failure */
async function safeSendKeys(target: string, keys: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await execAsync(`tmux send-keys -t "${target}" "${keys}"`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: sanitizeTmuxError(e) }
  }
}

/** Send keys with one retry after 200ms for transient failures */
async function safeSendKeysWithRetry(target: string, keys: string): Promise<{ ok: boolean; error?: string }> {
  const first = await safeSendKeys(target, keys)
  if (first.ok) return first

  // Don't retry if pane is gone
  if (first.error === 'Pane no longer exists') return first

  // Wait and retry once for transient failures
  await new Promise(r => setTimeout(r, 200))
  return safeSendKeys(target, keys)
}

// ═══════════════════════════════════════════════════════════════════════════
// Tmux Prompt Helper
// ═══════════════════════════════════════════════════════════════════════════

async function sendPromptToTmux(target: string, prompt: string): Promise<void> {
  // If empty prompt, just send Enter (accepts Claude's suggestion)
  if (!prompt) {
    await execAsync(`tmux send-keys -t "${target}" Enter`)
    return
  }

  // Slash commands (e.g. /clear, /exit) trigger Claude Code's TUI autocomplete
  // menu. The TUI intercepts typed characters and shows a selection popup.
  // Strategy: paste the text via tmux buffer (bypasses TUI character interception),
  // wait for TUI popup to appear, send Escape to dismiss it, then Enter.
  const isSlashCommand = prompt.startsWith('/')

  // Simple prompts (non-slash): use send-keys -l (literal mode) with batched Enter
  // This avoids temp file overhead for common cases
  if (!isSlashCommand && isSafeForLiteral(prompt)) {
    await sendKeysLiteral(target, prompt, { withEnter: true })
    return
  }

  // Complex prompts or slash commands: use buffer approach
  // Batch the load-buffer + paste-buffer + delete-buffer
  const tempFile = `/tmp/claude-rpg-prompt-${Date.now()}.txt`
  const bufferName = `rpg-${Date.now()}`
  writeFileSync(tempFile, prompt)

  try {
    // Build batched commands for buffer operations
    const bufferCmds = buildBufferCommands(bufferName, target, tempFile)
    await batchCommands(bufferCmds)

    // Small settle delay before Enter (paste can be async in terminal)
    await new Promise(r => setTimeout(r, PASTE_SETTLE_MS))

    if (isSlashCommand) {
      // Dismiss TUI autocomplete popup that appears for slash commands
      await execAsync(`tmux send-keys -t "${target}" Escape`)
      await new Promise(r => setTimeout(r, PASTE_SETTLE_MS))
    }

    await execAsync(`tmux send-keys -t "${target}" Enter`)
  } finally {
    await unlink(tempFile).catch(() => {})
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// File Watching
// ═══════════════════════════════════════════════════════════════════════════

let lastFileSize = 0
let isLoadingHistoricalEvents = false

function loadEventsFromFile() {
  if (!existsSync(EVENTS_FILE)) return

  const content = readFileSync(EVENTS_FILE, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  if (lines.length === 0) {
    lastFileSize = content.length
    return
  }

  // Reset companions to empty - rebuild entirely from events.
  // This prevents double-counting when companions.json was saved
  // with accumulated stats and events are replayed on startup.
  // Only reset when there are events to replay; after rotation
  // (empty file), companions stay loaded from companions.json.
  companions.length = 0

  // Mark that we're loading historical events (skip streak updates)
  isLoadingHistoricalEvents = true

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as ClaudeEvent
      handleEvent(event)
    } catch {
      // Skip malformed lines
    }
  }

  isLoadingHistoricalEvents = false
  lastFileSize = content.length

  // Save companions once after processing all historical events
  saveCompanions(DATA_DIR, companions)
}

// Cache for full event history (used for competitions)
let allEventsCache: ClaudeEvent[] = []
let allEventsCacheTime = 0
const ALL_EVENTS_CACHE_TTL_MS = 5000 // 5 second cache

function getAllEventsFromFile(): ClaudeEvent[] {
  const now = Date.now()

  // Return cached if still valid
  if (now - allEventsCacheTime < ALL_EVENTS_CACHE_TTL_MS && allEventsCache.length > 0) {
    return allEventsCache
  }

  if (!existsSync(EVENTS_FILE)) return []

  const content = readFileSync(EVENTS_FILE, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  const allEvents: ClaudeEvent[] = []
  for (const line of lines) {
    try {
      const raw = JSON.parse(line)
      // Basic normalization for timestamp
      const event: ClaudeEvent = {
        ...raw,
        timestamp: raw.timestamp || 0,
        sessionId: raw.session_id || raw.sessionId || '',
        cwd: raw.cwd || '',
        type: raw.type || (raw.hook_event_name === 'PostToolUse' ? 'post_tool_use' : 'pre_tool_use'),
        tool: raw.tool_name || raw.tool || '',
        toolUseId: raw.tool_use_id || raw.toolUseId || '',
        toolInput: raw.tool_input || raw.toolInput,
      }
      allEvents.push(event)
    } catch {
      // Skip malformed lines
    }
  }

  allEventsCache = allEvents
  allEventsCacheTime = now
  return allEvents
}

function watchEventsFile() {
  if (!existsSync(EVENTS_FILE)) {
    writeFileSync(EVENTS_FILE, '')
  }

  const watcher = watch(EVENTS_FILE, { persistent: true })

  watcher.on('change', () => {
    const content = readFileSync(EVENTS_FILE, 'utf-8')

    // Handle rotation: file was truncated
    if (content.length < lastFileSize) {
      lastFileSize = 0
    }

    if (content.length <= lastFileSize) return

    const newContent = content.slice(lastFileSize)
    lastFileSize = content.length

    const lines = newContent.trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ClaudeEvent
        handleEvent(event)
      } catch {
        // Skip malformed lines
      }
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Static File Serving
// ═══════════════════════════════════════════════════════════════════════════

// Compiled to dist/server/server/index.js → static files at dist/client/
const __server_dir = dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = join(__server_dir, '..', '..', 'client')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function serveStaticFile(res: http.ServerResponse, urlPath: string): boolean {
  // Prevent path traversal
  const safePath = urlPath.replace(/\.\./g, '').replace(/\/\//g, '/')
  const filePath = join(STATIC_DIR, safePath)

  // Ensure we don't escape the static directory
  if (!filePath.startsWith(STATIC_DIR)) {
    return false
  }

  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) return false

    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
    const content = readFileSync(filePath)

    // Hashed assets (Vite puts them in /assets/) get immutable caching
    const isHashedAsset = safePath.startsWith('/assets/')
    const cacheControl = isHashedAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': content.length,
      'Cache-Control': cacheControl,
    })
    res.end(content)
    return true
  } catch {
    return false
  }
}

function serveIndexHtml(res: http.ServerResponse): boolean {
  const indexPath = join(STATIC_DIR, 'index.html')
  try {
    const content = readFileSync(indexPath)
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
    })
    res.end(content)
    return true
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Dev Proxy Helpers
// ═══════════════════════════════════════════════════════════════════════════

function proxyRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const targetUrl = new URL(req.url || '/', DEV_BACKEND)
  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: DEV_BACKEND_PORT,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${DEV_BACKEND_PORT}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Dev backend not reachable' }))
  })

  req.pipe(proxyReq)
}

async function probeBackend(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port, path: '/health', method: 'GET', timeout: 1000 },
      (res) => {
        res.resume() // drain
        resolve(res.statusCode === 200)
      }
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end()
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP Server
// ═══════════════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  // ═══════════════════════════════════════════════════════════════════════════
  // Admin Endpoints (never proxied)
  // ═══════════════════════════════════════════════════════════════════════════

  if (url.pathname === '/api/admin/backends' && req.method === 'GET') {
    const [prodOk, devOk] = await Promise.all([
      probeBackend(PORT),
      probeBackend(DEV_BACKEND_PORT),
    ])
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      production: { ok: prodOk, port: PORT },
      dev: { ok: devOk, port: DEV_BACKEND_PORT },
      activeBackend: devProxyMode ? 'dev' : 'production',
    }))
    return
  }

  if (url.pathname === '/api/admin/backend' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { mode } = JSON.parse(body)
        if (mode !== 'production' && mode !== 'dev') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'mode must be "production" or "dev"' }))
          return
        }

        if (mode === 'dev') {
          const devOk = await probeBackend(DEV_BACKEND_PORT)
          if (!devOk) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Dev backend not running on port ' + DEV_BACKEND_PORT }))
            return
          }
          devProxyMode = true
          console.log('[claude-rpg] Switched to dev proxy mode')
        } else {
          devProxyMode = false
          console.log('[claude-rpg] Switched to production mode')
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, activeBackend: mode }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Dev Proxy (forward API/event/health to dev backend when active)
  // ═══════════════════════════════════════════════════════════════════════════

  if (devProxyMode) {
    const isProxiable = (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/admin/')) ||
                         url.pathname === '/event' ||
                         url.pathname === '/health'
    if (isProxiable) {
      proxyRequest(req, res)
      return
    }
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      companions: companions.length,
      windows: windows.length,
      whisper: isWhisperAvailable(),
      rpgFeatures: rpgEnabled,
      autoAcceptBypass: AUTO_ACCEPT_BYPASS,
      activeBackend: devProxyMode ? 'dev' : 'production',
    }))
    return
  }

  // Event ingestion (from hook or quest skills)
  // Note: Hook already writes to events file, so we only process here (no duplicate write)
  if (url.pathname === '/event' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const event = JSON.parse(body)

        // Check if this is a quest event (from skills) vs a Claude hook event
        if (isQuestEvent(event)) {
          handleQuestEvent(event as QuestEventPayload)
        } else {
          handleEvent(event as ClaudeEvent)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  // Audio transcription (whisper.cpp)
  if (url.pathname === '/api/transcribe' && req.method === 'POST') {
    if (!isWhisperAvailable()) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: false,
        error: 'Whisper not available. Please install whisper.cpp and download the model.',
      }))
      return
    }

    const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB limit
    const chunks: Buffer[] = []
    let totalSize = 0

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize <= MAX_AUDIO_SIZE) {
        chunks.push(chunk)
      }
    })

    req.on('end', async () => {
      try {
        if (totalSize > MAX_AUDIO_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Audio file too large (max 10MB)' }))
          return
        }

        const audioBuffer = Buffer.concat(chunks)
        if (audioBuffer.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'No audio data received' }))
          return
        }

        const text = await transcribeAudio(audioBuffer)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, text }))
      } catch (e) {
        console.error('[whisper] Transcription error:', e)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        // Sanitize error message - don't expose stack traces
        const errorMsg = e instanceof Error ? e.message : 'Transcription failed'
        res.end(JSON.stringify({ ok: false, error: errorMsg }))
      }
    })
    return
  }

  // List windows with panes
  if (url.pathname === '/api/windows' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: windows }))
    return
  }

  // Send prompt to pane
  const panePromptMatch = url.pathname.match(/^\/api\/panes\/([^/]+)\/prompt$/)
  if (panePromptMatch && req.method === 'POST') {
    const paneId = decodeURIComponent(panePromptMatch[1])
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      sendPaneNotFound(res)
      return
    }

    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { prompt, isPermissionResponse } = JSON.parse(body)
        const session = pane.process.claudeSession
        const terminalPrompt = session?.terminalPrompt

        // Handle special key sequences
        if (prompt === 'Escape') {
          // Send Escape key (for canceling submit)
          await execAsync(`tmux send-keys -t "${pane.target}" Escape`)
          // Clear prompt state on cancel
          if (session?.terminalPrompt || session?.pendingQuestion) {
            updateClaudeSession(pane.id, {
              terminalPrompt: undefined,
              pendingQuestion: undefined,
              status: 'idle',
            })
            savePanesCache()
            broadcast({ type: 'pane_update', payload: pane })
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        // Handle arrow key navigation (Up/Down)
        if (prompt === 'Up' || prompt === 'Down') {
          await execAsync(`tmux send-keys -t "${pane.target}" ${prompt}`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        // Determine response type from terminal prompt
        const isPermission = isPermissionResponse ||
          terminalPrompt?.type === 'permission' ||
          (prompt.length === 1 && /^[yn!*s]$/.test(prompt))

        // Permission responses: send single key without Enter
        // Question responses with numbers: send number key
        if (isPermission || (terminalPrompt && /^\d$/.test(prompt))) {
          // Validate permission key to prevent injection
          if (!/^[yn!*s\d]$/.test(prompt)) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Invalid permission key' }))
            return
          }

          // Single key press for permission (y/n/!/*/s) or number selection
          const sendResult = await safeSendKeysWithRetry(pane.target, prompt)

          if (!sendResult.ok) {
            broadcast({ type: 'pane_error', payload: { paneId: pane.id, message: sendResult.error!, timestamp: Date.now() } })
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: sendResult.error }))
            return
          }

          // Optimistically clear the prompt state
          // Terminal polling will verify and correct if needed
          if (session) {
            const updated = updateClaudeSession(pane.id, {
              terminalPrompt: undefined,
              status: 'working',
              lastActivity: Date.now(),
            })
            if (updated) {
              pane.process.claudeSession = updated
              savePanesCache()
              broadcast({ type: 'pane_update', payload: pane })
            }
          }
        } else {
          // Regular prompt: use buffer + paste + Enter
          await sendPromptToTmux(pane.target, prompt)

          // Update lastPrompt immediately so UI shows what was sent
          if (session && prompt) {
            const truncatedPrompt = prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt
            const updated = updateClaudeSession(pane.id, {
              lastPrompt: truncatedPrompt,
              terminalPrompt: undefined,
              status: 'working',
              lastActivity: Date.now(),
            })
            if (updated) {
              pane.process.claudeSession = updated
              savePanesCache()
              broadcast({ type: 'pane_update', payload: pane })
            }
          }
        }

        // Handle legacy pending question state (for backwards compatibility)
        if (session?.pendingQuestion && !terminalPrompt) {
          const pq = session.pendingQuestion

          // If already ready to submit, this is the final submission
          if (pq.readyToSubmit) {
            updateClaudeSession(pane.id, {
              pendingQuestion: undefined,
              status: 'working',
            })
          } else {
            const nextIndex = pq.currentIndex + 1

            if (nextIndex < pq.questions.length) {
              updateClaudeSession(pane.id, {
                pendingQuestion: {
                  ...pq,
                  currentIndex: nextIndex,
                },
                status: 'waiting',
              })
            } else {
              updateClaudeSession(pane.id, {
                pendingQuestion: {
                  ...pq,
                  readyToSubmit: true,
                },
                status: 'waiting',
              })
            }
          }
          savePanesCache()
          broadcast({ type: 'pane_update', payload: pane })
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        const errorMsg = sanitizeTmuxError(e)
        broadcast({ type: 'pane_error', payload: { paneId: pane.id, message: errorMsg, timestamp: Date.now() } })
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: errorMsg }))
      }
    })
    return
  }

  // Send signal to pane (e.g., Ctrl+C)
  const paneSignalMatch = url.pathname.match(/^\/api\/panes\/([^/]+)\/signal$/)
  if (paneSignalMatch && req.method === 'POST') {
    const paneId = decodeURIComponent(paneSignalMatch[1])
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      sendPaneNotFound(res)
      return
    }

    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { signal } = JSON.parse(body)
        // Send Ctrl+C via tmux
        if (signal === 'SIGINT') {
          await execAsync(`tmux send-keys -t "${pane.target}" C-c`)

          // After interrupt, optimistically reset Claude session state
          // The Stop hook may not fire if Claude wasn't mid-response
          // This ensures the UI shows input box instead of just Interrupt button
          if (pane.process.claudeSession) {
            // Small delay to let tmux process the interrupt
            await new Promise(r => setTimeout(r, 200))

            const updated = updateClaudeSession(pane.id, {
              status: 'idle',
              pendingQuestion: undefined,
              currentTool: undefined,
              currentFile: undefined,
              lastActivity: Date.now(),
            })
            if (updated) {
              pane.process.claudeSession = updated
              savePanesCache()
              broadcast({ type: 'pane_update', payload: pane })
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
      }
    })
    return
  }

  // Dismiss waiting status (clear pending question, set to idle)
  const paneDismissMatch = url.pathname.match(/^\/api\/panes\/([^/]+)\/dismiss$/)
  if (paneDismissMatch && req.method === 'POST') {
    const paneId = decodeURIComponent(paneDismissMatch[1])
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      sendPaneNotFound(res)
      return
    }

    // Clear pending question and set to idle
    if (pane.process.claudeSession) {
      const updated = updateClaudeSession(pane.id, {
        pendingQuestion: undefined,
        status: 'idle',
      })
      if (updated) {
        pane.process.claudeSession = updated
        savePanesCache()
        broadcast({ type: 'pane_update', payload: pane })
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // Refresh pane (scroll to bottom, reset state, refresh terminal)
  const paneRefreshMatch = url.pathname.match(/^\/api\/panes\/([^/]+)\/refresh$/)
  if (paneRefreshMatch && req.method === 'POST') {
    const paneId = decodeURIComponent(paneRefreshMatch[1])
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      sendPaneNotFound(res)
      return
    }

    try {
      // Scroll tmux pane to bottom to show latest content
      await execAsync(`tmux copy-mode -t "${pane.target}" \\; send-keys -t "${pane.target}" q`)
      await new Promise(r => setTimeout(r, 50))

      // Reset Claude session state if present
      if (pane.process.claudeSession) {
        const updated = updateClaudeSession(pane.id, {
          pendingQuestion: undefined,
          status: 'idle',
          currentTool: undefined,
          currentFile: undefined,
          lastError: undefined,
        })
        if (updated) {
          pane.process.claudeSession = updated
          savePanesCache()
        }
      }

      // Clear typing state
      pane.process.typing = false

      // Force fresh terminal capture with full scrollback
      const content = await captureTerminal(pane.target, true)
      if (content !== null) {
        lastTerminalContent.set(pane.id, content)
        pane.terminalContent = content
        const output: TerminalOutput = {
          paneId: pane.id,
          target: pane.target,
          content,
          timestamp: Date.now(),
        }
        broadcast({ type: 'terminal_output', payload: output })
      }

      broadcast({ type: 'pane_update', payload: pane })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
    }
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pane Management Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // Close pane (kill-pane)
  const paneCloseMatch = url.pathname.match(/^\/api\/panes\/([^/]+)\/close$/)
  if (paneCloseMatch && req.method === 'POST') {
    const paneId = decodeURIComponent(paneCloseMatch[1])
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      sendPaneNotFound(res)
      return
    }

    try {
      // Kill the pane
      await execAsync(`tmux kill-pane -t "${pane.target}"`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
    }
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Window Creation Endpoint
  // ═══════════════════════════════════════════════════════════════════════════

  // Create new window in session
  if (url.pathname === '/api/windows/create' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { sessionName: rawSessionName, windowName: rawWindowName } = JSON.parse(body)

        if (!rawSessionName || !rawWindowName) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'sessionName and windowName are required' }))
          return
        }

        // Sanitize inputs to prevent command injection
        const sessionName = rawSessionName.replace(/[^a-zA-Z0-9_-]/g, '')
        const windowName = rawWindowName.replace(/[^a-zA-Z0-9_-]/g, '')

        if (!sessionName || !windowName) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Invalid session or window name (alphanumeric, dash, underscore only)' }))
          return
        }

        // Check if session exists
        const sessionExists = windows.some(w => w.sessionName === sessionName)
        if (!sessionExists) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: `Session "${sessionName}" not found` }))
          return
        }

        // Check if window name already exists in session
        const windowExists = windows.some(w => w.sessionName === sessionName && w.windowName === windowName)
        if (windowExists) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: `Window "${windowName}" already exists in session "${sessionName}"` }))
          return
        }

        // Create new window in the session with the given name
        // -t specifies the target session, -n names the window
        await execAsync(`tmux new-window -t "${sessionName}:" -n "${windowName}"`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, sessionName, windowName }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
      }
    })
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Window Rename Endpoint
  // ═══════════════════════════════════════════════════════════════════════════

  const windowRenameMatch = url.pathname.match(/^\/api\/windows\/([^/]+)\/rename$/)
  if (windowRenameMatch && req.method === 'POST') {
    const windowId = decodeURIComponent(windowRenameMatch[1])
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { windowName: rawWindowName } = JSON.parse(body)

        if (!rawWindowName) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'windowName is required' }))
          return
        }

        // Sanitize input to prevent command injection
        const newName = rawWindowName.replace(/[^a-zA-Z0-9_-]/g, '')

        if (!newName) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Invalid window name (alphanumeric, dash, underscore only)' }))
          return
        }

        // Look up existing window
        const window = findWindowById(windows, windowId)
        if (!window) {
          sendWindowNotFound(res)
          return
        }

        // Check for duplicate names within the same session (exclude this window)
        const duplicateExists = windows.some(
          w => w.sessionName === window.sessionName && w.windowName === newName && w.id !== windowId
        )
        if (duplicateExists) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: `Window "${newName}" already exists in session "${window.sessionName}"` }))
          return
        }

        await execAsync(`tmux rename-window -t "${windowId}" "${newName}"`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, windowId, windowName: newName }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
      }
    })
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Close Window Endpoint (#48)
  // ═══════════════════════════════════════════════════════════════════════════

  const windowCloseMatch = url.pathname.match(/^\/api\/windows\/([^/]+)\/close$/)
  if (windowCloseMatch && req.method === 'POST') {
    const windowId = decodeURIComponent(windowCloseMatch[1])
    const window = findWindowById(windows, windowId)

    if (!window) {
      sendWindowNotFound(res)
      return
    }

    try {
      await execAsync(`tmux kill-window -t "${windowId}"`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, windowId }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
    }
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Window-level Pane Creation Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // Create new pane in window (auto-balanced)
  const windowNewPaneMatch = url.pathname.match(/^\/api\/windows\/([^/]+)\/new-pane$/)
  if (windowNewPaneMatch && req.method === 'POST') {
    const windowId = decodeURIComponent(windowNewPaneMatch[1])
    const window = findWindowById(windows, windowId)

    if (!window) {
      sendWindowNotFound(res)
      return
    }

    // Check max panes limit
    if (window.panes.length >= MAX_PANES_PER_WINDOW) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: false,
        error: `Maximum ${MAX_PANES_PER_WINDOW} panes per window`,
        paneCount: window.panes.length,
        maxPanes: MAX_PANES_PER_WINDOW,
      }))
      return
    }

    try {
      // Use first pane to split from (preserves cwd)
      const sourcePane = window.panes[0]

      // Split the pane, preserving working directory
      await execAsync(`tmux split-window -t "${sourcePane.target}" -c "${sourcePane.cwd}"`)

      // Auto-balance the layout with tiled arrangement
      await execAsync(`tmux select-layout -t "${window.id}" tiled`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, paneCount: window.panes.length + 1 }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
    }
    return
  }

  // Create new Claude pane in window (auto-balanced)
  const windowNewClaudeMatch = url.pathname.match(/^\/api\/windows\/([^/]+)\/new-claude$/)
  if (windowNewClaudeMatch && req.method === 'POST') {
    const windowId = decodeURIComponent(windowNewClaudeMatch[1])
    const window = findWindowById(windows, windowId)

    if (!window) {
      sendWindowNotFound(res)
      return
    }

    // Check max panes limit
    if (window.panes.length >= MAX_PANES_PER_WINDOW) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: false,
        error: `Maximum ${MAX_PANES_PER_WINDOW} panes per window`,
        paneCount: window.panes.length,
        maxPanes: MAX_PANES_PER_WINDOW,
      }))
      return
    }

    try {
      // Use first pane to split from (preserves cwd)
      const sourcePane = window.panes[0]

      // Split the pane, preserving working directory
      await execAsync(`tmux split-window -t "${sourcePane.target}" -c "${sourcePane.cwd}"`)

      // Auto-balance the layout with tiled arrangement
      await execAsync(`tmux select-layout -t "${window.id}" tiled`)

      // Small delay to let the new pane initialize
      await new Promise(r => setTimeout(r, 200))

      // Send 'claude' command to the new pane (tmux focuses the new pane after split)
      await execAsync(`tmux send-keys "claude" Enter`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, paneCount: window.panes.length + 1 }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
    }
    return
  }

  // List companions (for XP/stats)
  if (url.pathname === '/api/companions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: rpgEnabled ? companions : [] }))
    return
  }

  // List workers (Claude sessions)
  if (url.pathname === '/api/workers' && req.method === 'GET') {
    const sessions = Array.from(getSessionCache().values()).sort((a, b) => b.lastActivity - a.lastActivity)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: sessions }))
    return
  }

  // Send prompt to companion (#85) — routes to their active Claude pane
  const companionPromptMatch = url.pathname.match(/^\/api\/companions\/([^/]+)\/prompt$/)
  if (companionPromptMatch && req.method === 'POST') {
    const companionId = decodeURIComponent(companionPromptMatch[1])
    const companion = companions.find(c => c.id === companionId)

    if (!companion) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Companion not found' }))
      return
    }

    // Find a Claude pane working on this companion's repo
    const targetPane = windows.flatMap(w => w.panes).find(p =>
      p.process.type === 'claude' && p.repo?.path === companion.repo.path
    )

    if (!targetPane) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: `No active Claude pane for ${companion.name}` }))
      return
    }

    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body)
        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'prompt is required' }))
          return
        }

        await sendPromptToTmux(targetPane.target, prompt)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, paneId: targetPane.id, companionName: companion.name }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: sanitizeTmuxError(e) }))
      }
    })
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Quest Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // List all quests (active + recent completed)
  if (url.pathname === '/api/quests' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: rpgEnabled ? quests : [] }))
    return
  }

  // Create quest (from skill event) - also handled via /event, but direct API available
  if (url.pathname === '/api/quests' && req.method === 'POST') {
    if (!rpgEnabled) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, data: null }))
      return
    }
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const payload = JSON.parse(body)
        payload.type = 'quest_created'
        handleQuestEvent(payload as QuestEventPayload)
        const quest = quests.find(q => q.id === payload.questId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, data: quest }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  // Update quest (pause/resume/complete)
  const questMatch = url.pathname.match(/^\/api\/quests\/([^/]+)$/)
  if (questMatch && req.method === 'PATCH') {
    if (!rpgEnabled) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, data: null }))
      return
    }
    const questId = decodeURIComponent(questMatch[1])
    const quest = quests.find(q => q.id === questId)
    if (!quest) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Quest not found' }))
      return
    }

    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const updates = JSON.parse(body)
        if (updates.status && ['active', 'completed', 'paused'].includes(updates.status)) {
          quest.status = updates.status
          if (updates.status === 'completed') {
            quest.completedAt = Date.now()
          }
          saveQuests(DATA_DIR, quests)
          broadcast({ type: 'quest_update', payload: quest } as ServerMessage)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, data: quest }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Competition Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // Get all competitions (all categories, all periods)
  // Use full event history from file for accurate period-based stats
  if (url.pathname === '/api/competitions' && req.method === 'GET') {
    if (!rpgEnabled) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, data: [] }))
      return
    }
    const allEvents = getAllEventsFromFile()
    const competitions = getAllCompetitions(companions, allEvents)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: competitions }))
    return
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Static File Serving (production mode serves built client assets)
  // ═══════════════════════════════════════════════════════════════════════════

  // Try serving the exact file first
  if (serveStaticFile(res, url.pathname)) return

  // SPA fallback: non-API routes serve index.html for client-side routing
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/event')) {
    if (serveIndexHtml(res)) return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Not found' }))
})

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Server
// ═══════════════════════════════════════════════════════════════════════════

const wss = new WebSocketServer({ noServer: true })

// Handle WebSocket upgrades (supports dev proxy mode)
server.on('upgrade', (request, socket, head) => {
  if (devProxyMode) {
    // Proxy WebSocket to dev backend
    const devWs = new WebSocket(`ws://localhost:${DEV_BACKEND_PORT}/ws`)

    devWs.on('open', () => {
      wss.handleUpgrade(request, socket, head, (clientWs) => {
        // Pipe data bidirectionally
        clientWs.on('message', (data) => {
          if (devWs.readyState === WebSocket.OPEN) devWs.send(data)
        })
        devWs.on('message', (data) => {
          if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data.toString())
        })

        clientWs.on('close', () => devWs.close())
        devWs.on('close', () => {
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close()
        })
      })
    })

    devWs.on('error', () => {
      console.log('[claude-rpg] Dev WebSocket failed, reverting to production mode')
      devProxyMode = false
      socket.destroy()
    })

    return
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

wss.on('connection', (ws) => {
  clients.add(ws)

  // Send initial state
  ws.send(JSON.stringify({ type: 'connected' } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'windows', payload: windows } satisfies ServerMessage))
  if (rpgEnabled) {
    ws.send(JSON.stringify({ type: 'companions', payload: companions } satisfies ServerMessage))
    ws.send(JSON.stringify({ type: 'competitions', payload: getAllCompetitions(companions, getAllEventsFromFile()) } satisfies ServerMessage))
    ws.send(JSON.stringify({ type: 'quests_init', payload: quests } satisfies ServerMessage))
  }
  const sessions = Array.from(getSessionCache().values()).sort((a, b) => b.lastActivity - a.lastActivity)
  ws.send(JSON.stringify({ type: 'workers_init', payload: sessions } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'history', payload: events.slice(-100) } satisfies ServerMessage))

  // Send current terminal content for all panes
  const now = Date.now()
  for (const [paneId, content] of lastTerminalContent) {
    const output: TerminalOutput = { paneId, target: '', content, timestamp: now }
    ws.send(JSON.stringify({ type: 'terminal_output', payload: output } satisfies ServerMessage))
  }

  ws.on('message', (_data) => {
    // Handle client messages if needed
  })

  ws.on('close', () => {
    clients.delete(ws)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Tmux Control Mode Integration
// ═══════════════════════════════════════════════════════════════════════════

// Debounced terminal capture triggered by control mode output detection
// Control mode tells us WHEN output happened, but we use capture-pane
// to get the RENDERED content (control mode gives raw terminal data
// with cursor movement sequences that we can't easily interpret)
const pendingCaptures = new Map<string, NodeJS.Timeout>()

async function triggerTerminalCapture(paneId: string, target: string): Promise<void> {
  // Clear existing timeout for this pane
  const existing = pendingCaptures.get(paneId)
  if (existing) clearTimeout(existing)

  // Debounce rapid output events
  pendingCaptures.set(paneId, setTimeout(async () => {
    pendingCaptures.delete(paneId)

    // Use capture-pane to get rendered content
    const content = await captureTerminal(target)
    if (!content) return

    // Check if content actually changed
    const oldContent = lastTerminalContent.get(paneId)
    if (oldContent === content) return

    lastTerminalContent.set(paneId, content)

    const output: TerminalOutput = {
      paneId,
      target,
      content,
      timestamp: Date.now(),
    }

    broadcast({ type: 'terminal_output', payload: output })

    // Also trigger prompt detection for Claude panes
    const pane = findPaneById(windows, paneId)
    if (pane?.process.type === 'claude' && pane.process.claudeSession) {
      processClaudePaneContent(pane, content)
    }
  }, CONTROL_MODE_BROADCAST_DEBOUNCE_MS))
}

// Process Claude pane content for prompt detection (shared with polling)
function processClaudePaneContent(pane: TmuxPane, content: string): void {
  const session = pane.process.claudeSession
  if (!session) return

  const newPrompt = parseTerminalForPrompt(content)
  const oldPrompt = session.terminalPrompt

  if (hasPromptChanged(oldPrompt ?? null, newPrompt)) {
    if (newPrompt) {
      const updated = updateClaudeSession(pane.id, {
        terminalPrompt: newPrompt,
        status: 'waiting',
      })
      if (updated) {
        pane.process.claudeSession = updated
        savePanesCache()
        broadcast({ type: 'pane_update', payload: pane })
      }
    } else if (oldPrompt) {
      const newStatus = session.status === 'waiting' ? 'idle' : session.status
      const updated = updateClaudeSession(pane.id, {
        terminalPrompt: undefined,
        status: newStatus,
      })
      if (updated) {
        pane.process.claudeSession = updated
        savePanesCache()
        broadcast({ type: 'pane_update', payload: pane })
      }
    }
  } else {
    // Run reconciliation
    const reconciliation = reconcileSessionState(pane, content, session)
    if (reconciliation.stateChanged && reconciliation.newStatus) {
      console.log(
        `[reconciler] ${pane.id}: ${session.status} → ${reconciliation.newStatus} ` +
        `(${reconciliation.confidence}: ${reconciliation.reason})`
      )

      const updates: Partial<typeof session> = {
        status: reconciliation.newStatus,
      }
      if (reconciliation.newPrompt !== undefined) {
        updates.terminalPrompt = reconciliation.newPrompt ?? undefined
      }
      if (reconciliation.clearPrompt) {
        updates.terminalPrompt = undefined
        updates.pendingQuestion = undefined
      }

      const updated = updateClaudeSession(pane.id, updates)
      if (updated) {
        pane.process.claudeSession = updated
        savePanesCache()
        broadcast({ type: 'pane_update', payload: pane })
      }
    }
  }
}

function initControlMode(): void {
  const controlClient = getControlClient()

  controlClient.on('connected', () => {
    console.log('[claude-rpg] Tmux control mode connected')
    controlModeActive = true
    currentPollInterval = TMUX_POLL_INTERVAL_WITH_CONTROL_MS
  })

  controlClient.on('disconnected', (reason) => {
    console.log('[claude-rpg] Tmux control mode disconnected:', reason)
    controlModeActive = false
    currentPollInterval = TMUX_POLL_INTERVAL_MS
  })

  controlClient.on('error', (err) => {
    console.error('[claude-rpg] Tmux control mode error:', err.message)
  })

  controlClient.on('notification', (notification) => {
    switch (notification.type) {
      case 'output': {
        // Control mode detected output - trigger a capture to get rendered content
        // We don't use the raw streaming data because it contains cursor movements
        // that would require a full terminal emulator to interpret correctly
        const pane = findPaneById(windows, notification.paneId)
        if (pane) {
          triggerTerminalCapture(notification.paneId, pane.target)
        }
        break
      }

      case 'sessions-changed':
      case 'window-add':
      case 'window-close':
        // Trigger immediate structure poll
        pollTmux().catch(e => console.error('[claude-rpg] Poll error:', e))
        break

      case 'pane-exited':
        cleanupPaneState(notification.paneId)
        break
    }
  })

  // Start control mode connection
  controlClient.connect().catch((err) => {
    console.warn('[claude-rpg] Control mode unavailable:', err.message)
    console.log('[claude-rpg] Falling back to polling-only mode')
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════════════

loadPanesCache()
// Re-fetch missing avatars after cache restore (#90)
refetchMissingAvatars().catch(e => console.error('[claude-rpg] Avatar refetch error:', e))

if (rpgEnabled) {
  loadEventsFromFile()
  watchEventsFile()
}

// Start system stats monitoring (#80)
startDiskMonitoring()
// Broadcast system stats every 30 seconds
setInterval(async () => {
  const stats = await getSystemStats()
  broadcast({ type: 'system_stats', payload: stats })
}, 30_000)

// Control mode disabled - was causing tmux scrollback issues in some terminals
// TODO: Investigate why control mode affects scrollback in ConnectBot
// initControlMode()

// Initial tmux poll
pollTmux().catch(e => console.error('[claude-rpg] Initial poll error:', e))

server.listen(PORT, () => {
  console.log(`[claude-rpg] Server running on http://localhost:${PORT}`)
})
