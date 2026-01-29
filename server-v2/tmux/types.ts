/**
 * Tmux types - must match shared/types.ts for client compatibility
 */

export type PaneProcessType = 'claude' | 'shell' | 'process' | 'idle'

export interface ProcessInfo {
  pid: number
  command: string
  args: string[]
  cwd: string | null
}

// PaneProcess must match shared/types.ts
export interface PaneProcess {
  type: PaneProcessType
  command: string
  pid: number
  typing?: boolean
  claudeSession?: ClaudeSessionInfo
}

// Minimal ClaudeSessionInfo for v2 (subset of shared/types.ts)
export interface ClaudeSessionInfo {
  name: string
  status: 'idle' | 'typing' | 'working' | 'waiting' | 'error'
  avatarSvg?: string
  // Add more fields as needed for full compatibility
}

// RepoInfo for pane context
export interface RepoInfo {
  path: string
  name: string
  org?: string
}

export interface TmuxPane {
  id: string
  windowId?: string  // Internal use, not sent to client
  index: number
  active: boolean
  width: number
  height: number
  process: PaneProcess  // Now an object, not a string
  cwd: string
  repo?: RepoInfo
}

export interface TmuxWindow {
  id: string
  sessionName: string
  windowIndex: number   // Renamed from 'index'
  windowName: string    // Renamed from 'name'
  active?: boolean      // Optional, not used by client
  panes: TmuxPane[]
}

export interface TmuxSession {
  name: string
  attached: boolean
  windows: TmuxWindow[]
}

export interface TmuxState {
  sessions: TmuxSession[]
  windows: TmuxWindow[]
  panes: TmuxPane[]
}
