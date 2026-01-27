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

// ═══════════════════════════════════════════════════════════════════════════
// SESSION STATS (Worker) - tracks stats for a single Claude session
// Workers are the Claude instances that do the actual work, earning XP for Projects
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionStats {
  totalXPGained: number
  toolsUsed: Record<string, number>
  promptsReceived: number
  git: {
    commits: number
    pushes: number
    prsCreated: number
    prsMerged: number
  }
  commands: {
    testsRun: number
    buildsRun: number
  }
}

export function createDefaultSessionStats(): SessionStats {
  return {
    totalXPGained: 0,
    toolsUsed: {},
    promptsReceived: 0,
    git: {
      commits: 0,
      pushes: 0,
      prsCreated: 0,
      prsMerged: 0,
    },
    commands: {
      testsRun: 0,
      buildsRun: 0,
    },
  }
}

export interface QuestionOption {
  label: string
  description?: string
}

export interface Question {
  question: string
  header?: string
  options: QuestionOption[]
  multiSelect: boolean
}

export interface PendingQuestion {
  // All questions from the tool
  questions: Question[]
  // Current question index (0-based)
  currentIndex: number
  // Tool tracking
  toolUseId: string
  timestamp: number
  // True when all questions answered but user needs to confirm submission
  readyToSubmit?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL PROMPT (Source of truth for prompt state)
// ═══════════════════════════════════════════════════════════════════════════

export interface TerminalPromptOption {
  label: string
  key: string  // The key to press (1, 2, y, n, etc.)
}

export interface TerminalPrompt {
  type: 'question' | 'permission' | 'plan'
  tool?: string              // 'Bash', 'Edit', 'Write' for permissions
  command?: string           // Command preview for Bash permissions
  question: string           // Main question text
  options: TerminalPromptOption[]
  multiSelect: boolean
  footer?: string            // "Esc to cancel", etc.
  detectedAt: number
  contentHash: string        // For change detection
}

export interface SessionError {
  tool: string
  message?: string
  timestamp: number
}

/**
 * A subagent spawned via the Task tool (#32)
 */
export interface SubagentInfo {
  id: string              // toolUseId from pre_tool_use
  description: string     // short description (3-5 words)
  prompt?: string         // first 100 chars of the full prompt
  startedAt: number
}

/**
 * ClaudeSessionInfo represents a Worker - a Claude instance running in a pane.
 * Workers do the actual work and earn XP for Projects (Companions).
 */
export interface ClaudeSessionInfo {
  id: string              // session UUID
  name: string            // "Alice" (English name)
  avatarSvg?: string      // Bitcoin face
  status: SessionStatus
  terminalPrompt?: TerminalPrompt  // Source of truth from terminal parsing
  pendingQuestion?: PendingQuestion  // Deprecated: kept for fallback during migration
  lastError?: SessionError
  currentTool?: string
  currentFile?: string
  lastPrompt?: string     // Last user prompt (truncated for display)
  recentFiles?: string[]  // Recently touched files (last 5 unique)
  activeSubagents?: SubagentInfo[]  // Running subagents (#32)
  lastToolDuration?: number  // Duration of last completed tool (ms)
  tokens?: {
    current: number      // Current conversation token count
    cumulative: number   // Total tokens this session
  }
  stats?: SessionStats    // Stats for this session (in-memory only)
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
// Projects are git repositories that accumulate XP from Workers (Claude sessions)
// ═══════════════════════════════════════════════════════════════════════════

export interface StreakInfo {
  current: number        // Current consecutive days
  longest: number        // All-time longest streak
  lastActiveDate: string // YYYY-MM-DD format
}

/**
 * Companion represents a Project - a git repository with RPG progression.
 * Projects accumulate XP and stats from Workers (Claude sessions) working on them.
 */
export interface Companion {
  id: string
  name: string
  repo: RepoInfo
  level: number
  experience: number
  totalExperience: number
  stats: CompanionStats
  streak: StreakInfo
  npmScripts?: Record<string, string>  // Available npm scripts from package.json
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
  quests: {
    created: number
    phasesCompleted: number
    questsCompleted: number
    totalRetries: number
  }
  tokensUsed?: number  // Lifetime token consumption
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
  source?: string // e.g., 'clear' when session started via /clear command
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
// QUESTS (Cross-repo goals with phased execution)
// ═══════════════════════════════════════════════════════════════════════════

export type QuestStatus = 'active' | 'completed' | 'paused'

export type QuestPhaseStatus =
  | 'pending'
  | 'planned'
  | 'executing'
  | 'retrying'
  | 'completed'
  | 'failed'

export interface QuestPhase {
  id: string
  name: string
  order: number
  status: QuestPhaseStatus
  retryCount: number
  maxRetries: number           // Default 3
  taskCount?: number
  verificationResult?: 'pass' | 'fail'
  gaps?: string[]              // From verifier diagnosis
  startedAt?: number
  completedAt?: number
}

export interface Quest {
  id: string
  name: string
  description: string
  repos: string[]              // Cross-repo: ["claude-rpg", "x402-api"]
  phases: QuestPhase[]
  status: QuestStatus
  createdAt: number
  completedAt?: number
}

export type QuestEventType =
  | 'quest_created'
  | 'phase_planned'
  | 'phase_executing'
  | 'phase_verified'
  | 'phase_retrying'
  | 'quest_completed'

// ═══════════════════════════════════════════════════════════════════════════
// COMPETITIONS / LEADERBOARDS
// ═══════════════════════════════════════════════════════════════════════════

export type CompetitionCategory =
  | 'xp'        // Total XP
  | 'commits'   // Git commits
  | 'tests'     // Tests run
  | 'tools'     // Total tool uses
  | 'prompts'   // Prompts received
  | 'quests'    // Quests completed

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

export interface PaneError {
  paneId: string
  message: string
  timestamp: number
}

export interface SystemStats {
  cpu: {
    count: number
    loadAvg: [number, number, number]  // 1, 5, 15 min
  }
  memory: {
    totalGB: number
    freeGB: number
    usedPercent: number
  }
  disk: {
    totalGB: number
    freeGB: number
    usedPercent: number
  }
  uptime: number  // seconds
  timestamp: number
}

export type ServerMessage =
  | { type: 'connected' }
  | { type: 'windows'; payload: TmuxWindow[] }
  | { type: 'pane_update'; payload: TmuxPane }
  | { type: 'pane_removed'; payload: { paneId: string } }
  | { type: 'pane_error'; payload: PaneError }
  | { type: 'companions'; payload: Companion[] }
  | { type: 'companion_update'; payload: Companion }
  | { type: 'event'; payload: ClaudeEvent }
  | { type: 'xp_gain'; payload: XPGain }
  | { type: 'history'; payload: ClaudeEvent[] }
  | { type: 'terminal_output'; payload: TerminalOutput }
  | { type: 'competitions'; payload: Competition[] }
  | { type: 'quest_update'; payload: Quest }
  | { type: 'quests_init'; payload: Quest[] }
  | { type: 'quest_xp'; payload: { questId: string; phaseId: string; xp: number; reason: string } }
  | { type: 'system_stats'; payload: SystemStats }

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
