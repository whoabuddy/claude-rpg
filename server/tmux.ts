import { exec } from 'child_process'
import { promisify } from 'util'
import type {
  TmuxWindow,
  TmuxPane,
  PaneProcess,
  ClaudeSessionInfo,
} from '../shared/types.js'
import {
  detectRepoInfo,
  findPaneByTarget,
  findPaneById,
  getClaudePanes,
} from './utils.js'

const execAsync = promisify(exec)

// Re-export utilities for backward compatibility
export { findPaneByTarget, findPaneById, getClaudePanes }

// ═══════════════════════════════════════════════════════════════════════════
// State Management
// ═══════════════════════════════════════════════════════════════════════════

// Cache of Claude sessions by pane ID (persisted for avatars)
const claudeSessionsByPane = new Map<string, ClaudeSessionInfo>()

// ═══════════════════════════════════════════════════════════════════════════
// Tmux Polling
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Poll tmux for all windows and panes
 * Format: pane_id|session_name|window_index|window_name|pane_index|pane_active|pane_current_command|pane_pid|pane_current_path
 */
export async function pollTmuxState(): Promise<TmuxWindow[]> {
  try {
    const { stdout } = await execAsync(
      `tmux list-panes -a -F '#{pane_id}|#{session_name}|#{window_index}|#{window_name}|#{pane_index}|#{pane_active}|#{pane_current_command}|#{pane_pid}|#{pane_current_path}' 2>/dev/null || echo ""`,
      { timeout: 5000 }
    )

    if (!stdout.trim()) {
      return []
    }

    const lines = stdout.trim().split('\n').filter(Boolean)
    const windowMap = new Map<string, TmuxWindow>()

    for (const line of lines) {
      const [
        paneId,
        sessionName,
        windowIndexStr,
        windowName,
        paneIndexStr,
        paneActiveStr,
        currentCommand,
        pidStr,
        cwd,
      ] = line.split('|')

      const windowIndex = parseInt(windowIndexStr, 10)
      const paneIndex = parseInt(paneIndexStr, 10)
      const isActive = paneActiveStr === '1'
      const pid = parseInt(pidStr, 10)

      // Window ID is session:window_index
      const windowId = `${sessionName}:${windowIndex}`
      const target = `${sessionName}:${windowIndex}.${paneIndex}`

      // Get or create window
      let window = windowMap.get(windowId)
      if (!window) {
        window = {
          id: windowId,
          sessionName,
          windowIndex,
          windowName,
          panes: [],
        }
        windowMap.set(windowId, window)
      }

      // Detect process type and get Claude session if applicable
      const process = await detectPaneProcess(paneId, currentCommand, pid)

      // Detect repo info from cwd
      const repo = detectRepoInfo(cwd)

      const pane: TmuxPane = {
        id: paneId,
        target,
        paneIndex,
        isActive,
        process,
        cwd,
        repo,
      }

      window.panes.push(pane)
    }

    // Sort windows by session name + index, panes by index
    const windows = Array.from(windowMap.values())
    windows.sort((a, b) => {
      if (a.sessionName !== b.sessionName) {
        return a.sessionName.localeCompare(b.sessionName)
      }
      return a.windowIndex - b.windowIndex
    })
    for (const window of windows) {
      window.panes.sort((a, b) => a.paneIndex - b.paneIndex)
    }

    return windows
  } catch (e) {
    console.error('[claude-rpg] Error polling tmux:', e)
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Process Detection
// ═══════════════════════════════════════════════════════════════════════════

const SHELL_COMMANDS = ['bash', 'zsh', 'sh', 'fish']

interface ChildProcess {
  pid: number
  command: string
}

/**
 * Detect the type of process running in a pane
 */
async function detectPaneProcess(
  paneId: string,
  currentCommand: string,
  pid: number
): Promise<PaneProcess> {
  // Direct Claude detection
  if (currentCommand === 'claude') {
    return {
      type: 'claude',
      command: 'claude',
      pid,
      claudeSession: claudeSessionsByPane.get(paneId),
    }
  }

  // Shell with potential child processes
  if (SHELL_COMMANDS.includes(currentCommand)) {
    const children = await getChildProcesses(pid)
    const claudeChild = children.find(c => c.command.includes('claude'))

    if (claudeChild) {
      return {
        type: 'claude',
        command: 'claude',
        pid: claudeChild.pid,
        claudeSession: claudeSessionsByPane.get(paneId),
      }
    }

    // Shell with other children = running a process
    if (children.length > 0) {
      const mainChild = children[0]
      return {
        type: 'process',
        command: mainChild.command.split('/').pop() || mainChild.command,
        pid: mainChild.pid,
      }
    }

    // Empty shell
    return {
      type: 'shell',
      command: currentCommand,
      pid,
    }
  }

  // Non-shell process (node, python, etc.)
  return {
    type: 'process',
    command: currentCommand,
    pid,
  }
}

/**
 * Get child processes of a given PID
 */
async function getChildProcesses(ppid: number): Promise<ChildProcess[]> {
  try {
    const { stdout } = await execAsync(
      `ps --ppid ${ppid} -o pid=,comm= 2>/dev/null || echo ""`,
      { timeout: 1000 }
    )

    if (!stdout.trim()) {
      return []
    }

    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [pidStr, ...rest] = line.trim().split(/\s+/)
        return {
          pid: parseInt(pidStr, 10),
          command: rest.join(' '),
        }
      })
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Claude Session Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update Claude session info for a pane (called from hook events)
 */
export function updateClaudeSession(
  paneId: string,
  sessionInfo: Partial<ClaudeSessionInfo>
): ClaudeSessionInfo | undefined {
  let session = claudeSessionsByPane.get(paneId)

  if (!session && sessionInfo.id) {
    // Create new session
    session = {
      id: sessionInfo.id,
      name: sessionInfo.name || 'Unknown',
      status: 'idle',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ...sessionInfo,
    }
    claudeSessionsByPane.set(paneId, session)
    console.log(`[claude-rpg] New Claude session "${session.name}" in pane ${paneId}`)
  } else if (session) {
    // Update existing session
    Object.assign(session, sessionInfo, { lastActivity: Date.now() })
  }

  return session
}

/**
 * Get Claude session for a pane
 */
export function getClaudeSession(paneId: string): ClaudeSessionInfo | undefined {
  return claudeSessionsByPane.get(paneId)
}

/**
 * Remove Claude session for a pane
 */
export function removeClaudeSession(paneId: string): void {
  const session = claudeSessionsByPane.get(paneId)
  if (session) {
    console.log(`[claude-rpg] Removed Claude session "${session.name}" from pane ${paneId}`)
    claudeSessionsByPane.delete(paneId)
  }
}

/**
 * Export session cache for persistence
 */
export function getSessionCache(): Map<string, ClaudeSessionInfo> {
  return claudeSessionsByPane
}

/**
 * Import session cache (on startup)
 */
export function setSessionCache(cache: Map<string, ClaudeSessionInfo>): void {
  claudeSessionsByPane.clear()
  for (const [paneId, session] of cache) {
    claudeSessionsByPane.set(paneId, session)
  }
}
