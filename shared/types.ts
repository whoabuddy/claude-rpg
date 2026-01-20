// ═══════════════════════════════════════════════════════════════════════════
// COMPANION (Project)
// ═══════════════════════════════════════════════════════════════════════════

export interface Companion {
  id: string
  name: string
  repo: RepoInfo
  level: number
  experience: number
  totalExperience: number
  stats: CompanionStats
  state: CompanionState
  createdAt: number
  lastActivity: number
}

export interface RepoInfo {
  path: string           // /home/user/dev/org/repo
  remote?: string        // git@github.com:org/repo.git
  org?: string           // org
  name: string           // repo
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
  }
  blockchain: {
    clarinetChecks: number
    clarinetTests: number
    testnetDeploys: number
    mainnetDeploys: number
  }
}

export type CompanionStatus = 'idle' | 'working' | 'waiting' | 'attention' | 'offline'

export interface CompanionState {
  status: CompanionStatus
  activeClaudeSession?: string
  currentTool?: string
  currentFile?: string
  lastActivity: number
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS (from Claude Code hooks)
// ═══════════════════════════════════════════════════════════════════════════

export type ClaudeEventType =
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'stop'
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
}

export interface StopEvent extends BaseEvent {
  type: 'stop'
  reason?: string
  response?: string
}

export interface UserPromptSubmitEvent extends BaseEvent {
  type: 'user_prompt_submit'
  prompt: string
}

export interface NotificationEvent extends BaseEvent {
  type: 'notification'
  message: string
}

export type ClaudeEvent =
  | PreToolUseEvent
  | PostToolUseEvent
  | StopEvent
  | UserPromptSubmitEvent
  | NotificationEvent
  | BaseEvent

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
// WEBSOCKET MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

export interface TerminalOutput {
  companionId: string
  tmuxTarget: string
  content: string
  timestamp: number
}

export type ServerMessage =
  | { type: 'connected' }
  | { type: 'companions'; payload: Companion[] }
  | { type: 'companion_update'; payload: Companion }
  | { type: 'event'; payload: ClaudeEvent }
  | { type: 'xp_gain'; payload: XPGain }
  | { type: 'history'; payload: ClaudeEvent[] }
  | { type: 'terminal_output'; payload: TerminalOutput }

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

export interface SendPromptRequest {
  prompt: string
}

export interface CreateCompanionRequest {
  name: string
  repoPath: string
}
