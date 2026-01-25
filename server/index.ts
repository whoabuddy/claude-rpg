import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { watch } from 'chokidar'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { DEFAULTS, expandPath } from '../shared/defaults.js'

const execAsync = promisify(exec)

import type {
  ClaudeEvent,
  Companion,
  ServerMessage,
  TmuxWindow,
  TmuxPane,
  TerminalOutput,
  ClaudeSessionInfo,
  PreToolUseEvent,
  CompetitionCategory,
  TimePeriod,
  TerminalPrompt,
} from '../shared/types.js'
import { parseTerminalForPrompt, hasPromptChanged } from './terminal-parser.js'
import { reconcileSessionState } from './state-reconciler.js'
import { processEvent, detectCommandXP } from './xp.js'
import { findOrCreateCompanion, saveCompanions, loadCompanions, fetchBitcoinFace, getSessionName } from './companions.js'
import { getAllCompetitions, getCompetition, getStreakLeaderboard, updateStreak } from './competitions.js'
import {
  pollTmuxState,
  updateClaudeSession,
  getClaudeSession,
  removeClaudeSession,
  findPaneByTarget,
  findPaneById,
  getSessionCache,
  setSessionCache,
} from './tmux.js'
import { findWindowById } from './utils.js'
import { getControlClient } from './tmux-control.js'

// Maximum panes per window (keeps tmux TUI manageable)
const MAX_PANES_PER_WINDOW = 4
import { isWhisperAvailable, transcribeAudio } from './whisper.js'

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.CLAUDE_RPG_PORT || String(DEFAULTS.SERVER_PORT))
const DATA_DIR = expandPath(process.env.CLAUDE_RPG_DATA_DIR || DEFAULTS.DATA_DIR)
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

let companions: Companion[] = loadCompanions(DATA_DIR)
let windows: TmuxWindow[] = []
const events: ClaudeEvent[] = []
const clients = new Set<WebSocket>()
const seenEventIds = new Set<string>()

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
        cache.set(paneId, session as ClaudeSessionInfo)
      }
      setSessionCache(cache)
    }
  } catch (e) {
    console.error('[claude-rpg] Cache load error:', e)
  }
}

function savePanesCache(): void {
  try {
    const cache = getSessionCache()
    const sessions: Record<string, ClaudeSessionInfo> = {}
    for (const [paneId, session] of cache) {
      sessions[paneId] = session
    }
    writeFileSync(PANES_CACHE_FILE, JSON.stringify({ sessions }, null, 2))
  } catch (e) {
    console.error('[claude-rpg] Cache save error:', e)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Broadcasting
// ═══════════════════════════════════════════════════════════════════════════

function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tmux Polling with Change Detection
// ═══════════════════════════════════════════════════════════════════════════

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
      // Create new Claude session
      const name = getSessionName(event.sessionId)
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
        sessionInfo.status = 'idle'
        sessionInfo.currentTool = undefined
        sessionInfo.currentFile = undefined
        sessionInfo.pendingQuestion = undefined
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
        const notifEvent = event as import('../shared/types.js').NotificationEvent
        if (notifEvent.message) {
          // Check for permission-related notifications
          if (notifEvent.message.includes('permission') || notifEvent.message.includes('waiting')) {
            sessionInfo.status = 'waiting'
          }
        }
      } else if (event.type === 'subagent_stop') {
        // Subagent finished - main agent continues working
        // Don't change status - main agent is still running
      } else if (event.type === 'session_start') {
        // New or resumed session - reset to idle state
        const startEvent = event as import('../shared/types.js').SessionStartEvent
        sessionInfo.status = 'idle'
        sessionInfo.currentTool = undefined
        sessionInfo.currentFile = undefined
        sessionInfo.pendingQuestion = undefined
        sessionInfo.lastError = undefined
        // Set lastPrompt to show the command that triggered the new session
        if (startEvent.source === 'clear') {
          sessionInfo.lastPrompt = '/clear'
        }
      } else if (event.type === 'session_end') {
        // Session ended - remove from cache
        removeClaudeSession(pane.id)
      }

      const updatedSession = updateClaudeSession(pane.id, sessionInfo)
      savePanesCache()

      // Update the pane object with fresh session data before broadcasting
      if (updatedSession && pane.process.type === 'claude') {
        pane.process.claudeSession = updatedSession
      }

      broadcast({ type: 'pane_update', payload: pane })
    }
  }

  // Process XP for companion (by CWD → repo)
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
          // Update session stats based on command type
          if (cmdDetection.statKey === 'git.commits') sessionStats.git.commits++
          else if (cmdDetection.statKey === 'git.pushes') sessionStats.git.pushes++
          else if (cmdDetection.statKey === 'git.prsCreated') sessionStats.git.prsCreated++
          else if (cmdDetection.statKey === 'git.prsMerged') sessionStats.git.prsMerged++
          else if (cmdDetection.statKey === 'commands.testsRun') sessionStats.commands.testsRun++
          else if (cmdDetection.statKey === 'commands.buildsRun') sessionStats.commands.buildsRun++
        }
      }
    }

    // Broadcast pane update to show new stats
    savePanesCache()
    broadcast({ type: 'pane_update', payload: pane })
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

async function captureTerminal(target: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `tmux capture-pane -p -t "${target}" -S -30 2>/dev/null || echo ""`,
      { timeout: 1000 }
    )
    return stdout.trim()
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
      // Determine capture rate based on pane type
      // All Claude panes get fast capture, others get slow
      const isClaudePane = pane.process.type === 'claude'

      // Always poll all panes - control mode just supplements with faster detection
      // Don't skip Claude panes even when control mode is active (it's not 100% reliable)
      const interval = isClaudePane ? TERMINAL_ACTIVE_INTERVAL_MS : TERMINAL_IDLE_INTERVAL_MS

      // Check per-pane rate limiting
      const lastCapture = lastPaneCapture.get(pane.id) || 0
      if (now - lastCapture < interval) continue
      lastPaneCapture.set(pane.id, now)

      const content = await captureTerminal(pane.target)
      if (content === null) continue

      const contentChanged = lastTerminalContent.get(pane.id) !== content
      const lastTyping = lastTypingActivity.get(pane.id) || 0

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

      // Terminal-based prompt detection for Claude panes
      // This is the source of truth for prompt state
      if (isClaudePane && pane.process.claudeSession) {
        processClaudePaneContent(pane, content)
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

// ═══════════════════════════════════════════════════════════════════════════
// Tmux Prompt Helper
// ═══════════════════════════════════════════════════════════════════════════

async function sendPromptToTmux(target: string, prompt: string): Promise<void> {
  // If empty prompt, just send Enter (accepts Claude's suggestion)
  if (!prompt) {
    await execAsync(`tmux send-keys -t "${target}" Enter`)
    return
  }

  // For non-empty prompts, use buffer to handle special characters
  const tempFile = `/tmp/claude-rpg-prompt-${Date.now()}.txt`
  writeFileSync(tempFile, prompt)

  await execAsync(`tmux load-buffer ${tempFile}`)
  await execAsync(`tmux paste-buffer -t "${target}"`)
  await new Promise(r => setTimeout(r, PASTE_SETTLE_MS))
  await execAsync(`tmux send-keys -t "${target}" Enter`)

  await unlink(tempFile).catch(() => {})
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

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      companions: companions.length,
      windows: windows.length,
      whisper: isWhisperAvailable(),
    }))
    return
  }

  // Event ingestion (from hook)
  // Note: Hook already writes to events file, so we only process here (no duplicate write)
  if (url.pathname === '/event' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const event = JSON.parse(body) as ClaudeEvent
        handleEvent(event)
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

  // Get single pane
  const paneMatch = url.pathname.match(/^\/api\/panes\/([^/]+)$/)
  if (paneMatch && req.method === 'GET') {
    const paneId = decodeURIComponent(paneMatch[1])
    const pane = findPaneById(windows, paneId)

    if (!pane) {
      sendPaneNotFound(res)
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: pane }))
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

        // Determine response type from terminal prompt
        const isPermission = isPermissionResponse ||
          terminalPrompt?.type === 'permission' ||
          (prompt.length === 1 && /^[yn!*s]$/.test(prompt))

        // Permission responses: send single key without Enter
        // Question responses with numbers: send number key
        if (isPermission || (terminalPrompt && /^\d$/.test(prompt))) {
          // Single key press for permission (y/n/!/*/s) or number selection
          await execAsync(`tmux send-keys -t "${pane.target}" "${prompt}"`)

          // Optimistically clear the prompt state
          // Terminal polling will verify and correct if needed
          if (session) {
            const updated = updateClaudeSession(pane.id, {
              terminalPrompt: undefined,
              status: 'working',
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
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(e) }))
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
        res.end(JSON.stringify({ ok: false, error: String(e) }))
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

      // Force fresh terminal capture
      const content = await captureTerminal(pane.target)
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
      res.end(JSON.stringify({ ok: false, error: String(e) }))
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
      res.end(JSON.stringify({ ok: false, error: String(e) }))
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
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
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
      res.end(JSON.stringify({ ok: false, error: String(e) }))
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
      res.end(JSON.stringify({ ok: false, error: String(e) }))
    }
    return
  }

  // List companions (for XP/stats)
  if (url.pathname === '/api/companions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: companions }))
    return
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Competition Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // Get all competitions (all categories, all periods)
  // Use full event history from file for accurate period-based stats
  if (url.pathname === '/api/competitions' && req.method === 'GET') {
    const allEvents = getAllEventsFromFile()
    const competitions = getAllCompetitions(companions, allEvents)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: competitions }))
    return
  }

  // Get streaks leaderboard
  if (url.pathname === '/api/competitions/streaks' && req.method === 'GET') {
    const entries = getStreakLeaderboard(companions)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: entries }))
    return
  }

  // Get single category competition
  const competitionMatch = url.pathname.match(/^\/api\/competitions\/([^/]+)$/)
  if (competitionMatch && req.method === 'GET') {
    const category = competitionMatch[1] as CompetitionCategory
    const validCategories = ['xp', 'commits', 'tests', 'tools', 'prompts']
    if (!validCategories.includes(category)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Invalid category' }))
      return
    }

    const period = (url.searchParams.get('period') || 'all') as TimePeriod
    const allEvents = getAllEventsFromFile()
    const competition = getCompetition(companions, allEvents, category, period)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, data: competition }))
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Not found' }))
})

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Server
// ═══════════════════════════════════════════════════════════════════════════

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  clients.add(ws)

  // Send initial state
  ws.send(JSON.stringify({ type: 'connected' } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'windows', payload: windows } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'companions', payload: companions } satisfies ServerMessage))
  ws.send(JSON.stringify({ type: 'competitions', payload: getAllCompetitions(companions, getAllEventsFromFile()) } satisfies ServerMessage))
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
        // Clean up state for exited pane
        lastTerminalContent.delete(notification.paneId)
        pendingCaptures.delete(notification.paneId)
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
loadEventsFromFile()
watchEventsFile()

// Initialize control mode (non-blocking)
initControlMode()

// Initial tmux poll
pollTmux().catch(e => console.error('[claude-rpg] Initial poll error:', e))

server.listen(PORT, () => {
  console.log(`[claude-rpg] Server running on http://localhost:${PORT}`)
})
