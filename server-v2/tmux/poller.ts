/**
 * Tmux polling
 */

import { createLogger } from '../lib/logger'
import { classifyProcess, getProcessCwd } from './process'
import { isTmuxRunning } from './commands'
import type { TmuxWindow, TmuxPane, TmuxState } from './types'

const log = createLogger('tmux-poller')

interface ParsedPane {
  paneId: string
  windowId: string
  paneIndex: number
  active: boolean
  width: number
  height: number
  pid: number
  command: string
}

interface ParsedWindow {
  windowId: string
  sessionName: string
  windowIndex: number
  windowName: string
  active: boolean
}

/**
 * Parse tmux list-panes output
 */
function parsePanes(output: string): ParsedPane[] {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const parts = line.split(':')
      if (parts.length < 8) return null

      return {
        paneId: parts[0],
        windowId: parts[1],
        paneIndex: parseInt(parts[2], 10),
        active: parts[3] === '1',
        width: parseInt(parts[4], 10),
        height: parseInt(parts[5], 10),
        pid: parseInt(parts[6], 10),
        command: parts[7],
      }
    })
    .filter((p): p is ParsedPane => p !== null)
}

/**
 * Parse tmux list-windows output
 */
function parseWindows(output: string): ParsedWindow[] {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const parts = line.split(':')
      if (parts.length < 5) return null

      return {
        windowId: parts[0],
        sessionName: parts[1],
        windowIndex: parseInt(parts[2], 10),
        windowName: parts[3],
        active: parts[4] === '1',
      }
    })
    .filter((w): w is ParsedWindow => w !== null)
}

/**
 * Poll tmux for current state
 */
export async function pollTmux(): Promise<TmuxState> {
  // Check if tmux is running
  if (!await isTmuxRunning()) {
    log.debug('Tmux not running')
    return { sessions: [], windows: [], panes: [] }
  }

  try {
    // Get windows
    const windowsResult = await Bun.spawn([
      'tmux', 'list-windows', '-a',
      '-F', '#{window_id}:#{session_name}:#{window_index}:#{window_name}:#{window_active}'
    ], { stdout: 'pipe' })
    const windowsOutput = await new Response(windowsResult.stdout).text()
    const parsedWindows = parseWindows(windowsOutput)

    // Get panes
    const panesResult = await Bun.spawn([
      'tmux', 'list-panes', '-a',
      '-F', '#{pane_id}:#{window_id}:#{pane_index}:#{pane_active}:#{pane_width}:#{pane_height}:#{pane_pid}:#{pane_current_command}'
    ], { stdout: 'pipe' })
    const panesOutput = await new Response(panesResult.stdout).text()
    const parsedPanes = parsePanes(panesOutput)

    // Enrich panes with process info
    const panes: TmuxPane[] = await Promise.all(
      parsedPanes.map(async (p) => {
        const processType = await classifyProcess(p.pid)
        const cwd = await getProcessCwd(p.pid)

        return {
          id: p.paneId,
          windowId: p.windowId,
          index: p.paneIndex,
          active: p.active,
          width: p.width,
          height: p.height,
          process: processType,
          command: p.command,
          cwd,
          pid: p.pid,
        }
      })
    )

    // Build windows with panes
    const windows: TmuxWindow[] = parsedWindows.map(w => ({
      id: w.windowId,
      sessionName: w.sessionName,
      index: w.windowIndex,
      name: w.windowName,
      active: w.active,
      panes: panes.filter(p => p.windowId === w.windowId),
    }))

    // Group by session
    const sessionMap = new Map<string, TmuxWindow[]>()
    for (const w of windows) {
      const existing = sessionMap.get(w.sessionName) || []
      existing.push(w)
      sessionMap.set(w.sessionName, existing)
    }

    const sessions = Array.from(sessionMap.entries()).map(([name, wins]) => ({
      name,
      attached: true, // TODO: Check actual attachment status
      windows: wins,
    }))

    log.debug('Poll complete', {
      sessions: sessions.length,
      windows: windows.length,
      panes: panes.length,
    })

    return { sessions, windows, panes }
  } catch (error) {
    log.error('Poll failed', { error: error instanceof Error ? error.message : String(error) })
    return { sessions: [], windows: [], panes: [] }
  }
}

// Polling control
let pollInterval: Timer | null = null
let pollCallback: ((state: TmuxState) => void) | null = null

/**
 * Start polling tmux
 */
export function startPolling(callback: (state: TmuxState) => void, intervalMs: number): void {
  if (pollInterval) {
    stopPolling()
  }

  pollCallback = callback
  log.info('Starting tmux polling', { intervalMs })

  // Initial poll
  pollTmux().then(state => pollCallback?.(state))

  // Start interval
  pollInterval = setInterval(async () => {
    const state = await pollTmux()
    pollCallback?.(state)
  }, intervalMs)
}

/**
 * Stop polling tmux
 */
export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
    pollCallback = null
    log.info('Stopped tmux polling')
  }
}
