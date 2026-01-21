// ═══════════════════════════════════════════════════════════════════════════
// TMUX PANE-CENTRIC MODEL (Primary entities - ephemeral, polled from tmux)
// ═══════════════════════════════════════════════════════════════════════════

export interface TmuxWindow {
  id: string              // "work:1" (session:window_index)
  sessionName: string     // "work"
  windowIndex: number     // 1
  windowName: string      // "claude-rpg"
  panes: TmuxPane[]
}

export type PaneProcessType = 'claude' | 'shell' | 'process' | 'idle'

export interface PaneProcess {
  type: PaneProcessType
  command: string         // "claude", "bash", "node"
  pid: number
  typing?: boolean        // true if terminal content changed recently (all pane types)
  claudeSession?: ClaudeSessionInfo  // only when type='claude'
}

export type SessionStatus = 'idle' | 'typing' | 'working' | 'waiting' | 'error'

export interface PendingQuestion {
  question: string
  options: Array<{ label: string; description?: string }>
  multiSelect: boolean
  toolUseId: string
  timestamp: number
}

export interface SessionError {
  tool: string
  message?: string
  timestamp: number
}

export interface ClaudeSessionInfo {
  id: string              // session UUID
  name: string            // "Alice" (English name)
  avatarSvg?: string      // Bitcoin face
  status: SessionStatus
  pendingQuestion?: PendingQuestion
  lastError?: SessionError
  currentTool?: string
  currentFile?: string
  lastPrompt?: string     // Last user prompt (truncated for display)
  recentFiles?: string[]  // Recently touched files (last 5 unique)
  createdAt: number
  lastActivity: number
}

export interface TmuxPane {
  id: string              // "%51" (unique pane ID)
  target: string          // "work:2.0"
  paneIndex: number       // 0
  isActive: boolean       // active pane in window
  process: PaneProcess
  cwd: string
  repo?: RepoInfo         // git detection
  terminalContent?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANION (Project) - for XP/stats persistence
// ═══════════════════════════════════════════════════════════════════════════

export interface StreakInfo {
  current: number        // Current consecutive days
  longest: number        // All-time longest streak
  lastActiveDate: string // YYYY-MM-DD format
}

export interface Companion {
  id: string
  name: string
  repo: RepoInfo
  level: number
  experience: number
  totalExperience: number
  stats: CompanionStats
  streak: StreakInfo
  createdAt: number
  lastActivity: number
}

export interface RepoInfo {
  path: string           // /home/user/dev/org/repo
  remote?: string        // git@github.com:org/repo.git
  org?: string           // org
  name: string           // repo
  // Git status (populated async)
  branch?: string        // current branch name
  defaultBranch?: string // main or master
  ahead?: number         // commits ahead of origin
  behind?: number        // commits behind origin
  isDirty?: boolean      // has uncommitted changes
  // Fork info
  upstream?: {
    org: string
    name: string
    remote: string
  }
}

export interface CompanionStats {
  toolsUsed: Record<string, number>
  promptsReceived: number
  sessionsCompleted: number
  git: {
    commits: number
    pushes: number
    prsCreated: number
    prsMerged: number
  }
  commands: {
    testsRun: number
    buildsRun: number
    deploysRun: number
    lintsRun: number
  }
  blockchain: {
    clarinetChecks: number
    clarinetTests: number
    testnetDeploys: number
    mainnetDeploys: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS (from Claude Code hooks)
// ═══════════════════════════════════════════════════════════════════════════

export type ClaudeEventType =
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'stop'
  | 'subagent_stop'
  | 'user_prompt_submit'
  | 'notification'
  | 'session_start'
  | 'session_end'

export interface BaseEvent {
  id?: string
  type: ClaudeEventType
  timestamp: number
  sessionId: string
  cwd: string
  tmuxTarget?: string
  hookType?: string
}

export interface PreToolUseEvent extends BaseEvent {
  type: 'pre_tool_use'
  tool: string
  toolUseId: string
  toolInput?: Record<string, unknown>
}

export interface PostToolUseEvent extends BaseEvent {
  type: 'post_tool_use'
  tool: string
  toolUseId: string
  success: boolean
  duration?: number
  toolResponse?: unknown
  toolInput?: Record<string, unknown>
}

export interface StopEvent extends BaseEvent {
  type: 'stop'
  reason?: string
  response?: string
}

export interface SubagentStopEvent extends BaseEvent {
  type: 'subagent_stop'
  reason?: string
}

export interface UserPromptSubmitEvent extends BaseEvent {
  type: 'user_prompt_submit'
  prompt: string
}

export interface NotificationEvent extends BaseEvent {
  type: 'notification'
  message: string
}

export interface SessionStartEvent extends BaseEvent {
  type: 'session_start'
}

export interface SessionEndEvent extends BaseEvent {
  type: 'session_end'
}

export type ClaudeEvent =
  | PreToolUseEvent
  | PostToolUseEvent
  | StopEvent
  | SubagentStopEvent
  | UserPromptSubmitEvent
  | NotificationEvent
  | SessionStartEvent
  | SessionEndEvent

// ═══════════════════════════════════════════════════════════════════════════
// XP SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export interface XPGain {
  companionId: string
  amount: number
  type: string
  description: string
  timestamp: number
}

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

export function levelFromTotalXP(totalXP: number): { level: number; currentXP: number; nextLevelXP: number } {
  let level = 1
  let xpNeeded = xpForLevel(level)
  let accumulated = 0

  while (accumulated + xpNeeded <= totalXP) {
    accumulated += xpNeeded
    level++
    xpNeeded = xpForLevel(level)
  }

  return {
    level,
    currentXP: totalXP - accumulated,
    nextLevelXP: xpNeeded,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPETITIONS / LEADERBOARDS
// ═══════════════════════════════════════════════════════════════════════════

export type CompetitionCategory =
  | 'xp'        // Total XP
  | 'commits'   // Git commits
  | 'tests'     // Tests run
  | 'tools'     // Total tool uses
  | 'prompts'   // Prompts received

export type TimePeriod = 'today' | 'week' | 'all'

export interface LeaderboardEntry {
  companionId: string
  companionName: string
  rank: number
  value: number        // XP, commits, etc.
  streak: StreakInfo
  change?: number      // Position change from previous period
}

export interface Competition {
  category: CompetitionCategory
  period: TimePeriod
  entries: LeaderboardEntry[]
  updatedAt: number
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

export interface TerminalOutput {
  paneId: string
  target: string
  content: string
  timestamp: number
}

export type ServerMessage =
  | { type: 'connected' }
  | { type: 'windows'; payload: TmuxWindow[] }
  | { type: 'pane_update'; payload: TmuxPane }
  | { type: 'pane_removed'; payload: { paneId: string } }
  | { type: 'companions'; payload: Companion[] }
  | { type: 'companion_update'; payload: Companion }
  | { type: 'event'; payload: ClaudeEvent }
  | { type: 'xp_gain'; payload: XPGain }
  | { type: 'history'; payload: ClaudeEvent[] }
  | { type: 'terminal_output'; payload: TerminalOutput }
  | { type: 'competitions'; payload: Competition[] }

export type ClientMessage =
  | { type: 'subscribe' }
  | { type: 'get_history'; payload: { companionId?: string; limit?: number } }

// ═══════════════════════════════════════════════════════════════════════════
// API TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
