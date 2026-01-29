/**
 * Tmux types
 */

export type PaneProcessType = 'claude' | 'shell' | 'process' | 'idle'

export interface ProcessInfo {
  pid: number
  command: string
  args: string[]
  cwd: string | null
}

export interface TmuxPane {
  id: string
  windowId: string
  index: number
  active: boolean
  width: number
  height: number
  process: PaneProcessType
  command: string
  cwd: string | null
  pid: number | null
}

export interface TmuxWindow {
  id: string
  sessionName: string
  index: number
  name: string
  active: boolean
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
