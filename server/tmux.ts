import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { join, basename } from 'path'
import type {
  TmuxWindow,
  TmuxPane,
  PaneProcess,
  PaneProcessType,
  RepoInfo,
  ClaudeSessionInfo,
} from '../shared/types.js'

const execAsync = promisify(exec)

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
  if (['bash', 'zsh', 'sh', 'fish'].includes(currentCommand)) {
    // Check for Claude running as child process
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

interface ChildProcess {
  pid: number
  command: string
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
// Git Repo Detection
// ═══════════════════════════════════════════════════════════════════════════

function detectRepoInfo(cwd: string): RepoInfo | undefined {
  if (!cwd) return undefined

  try {
    // Check if it's a git repo
    let repoRoot = cwd
    const gitDir = join(cwd, '.git')
    if (!existsSync(gitDir)) {
      // Try to find .git in parent directories
      let current = cwd
      while (current !== '/') {
        if (existsSync(join(current, '.git'))) {
          repoRoot = current
          break
        }
        current = join(current, '..')
      }
      if (!existsSync(join(repoRoot, '.git'))) {
        return undefined
      }
    }

    // Get remote URL
    let remote: string | undefined
    let org: string | undefined
    let name: string

    try {
      remote = execSync('git remote get-url origin', {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()

      // Parse org/name from remote
      const match = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
      if (match) {
        org = match[1]
        name = match[2]
      } else {
        name = basename(repoRoot)
      }
    } catch {
      name = basename(repoRoot)
    }

    return {
      path: repoRoot,
      remote,
      org,
      name,
    }
  } catch {
    return undefined
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
 * Find pane by tmux target (session:window.pane format)
 */
export function findPaneByTarget(
  windows: TmuxWindow[],
  target: string
): TmuxPane | undefined {
  for (const window of windows) {
    for (const pane of window.panes) {
      if (pane.target === target) {
        return pane
      }
    }
  }
  return undefined
}

/**
 * Find pane by pane ID
 */
export function findPaneById(
  windows: TmuxWindow[],
  paneId: string
): TmuxPane | undefined {
  for (const window of windows) {
    for (const pane of window.panes) {
      if (pane.id === paneId) {
        return pane
      }
    }
  }
  return undefined
}

/**
 * Get all Claude panes
 */
export function getClaudePanes(windows: TmuxWindow[]): TmuxPane[] {
  const panes: TmuxPane[] = []
  for (const window of windows) {
    for (const pane of window.panes) {
      if (pane.process.type === 'claude') {
        panes.push(pane)
      }
    }
  }
  return panes
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
