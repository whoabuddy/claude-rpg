/**
 * Tmux polling
 */

import { createLogger } from '../lib/logger'
import { getConfig } from '../lib/config'
import { classifyProcess, getProcessCwd } from './process'
import { isTmuxRunning, capturePane } from './commands'
import { buildClaudeSessionInfo } from './session-builder'
import type { TmuxWindow, TmuxPane, TmuxState, PaneProcessType, RepoInfo } from './types'

const log = createLogger('tmux-poller')

// Adaptive capture intervals based on activity state
const CAPTURE_INTERVAL_ACTIVE_MS = 250   // Content changed within 2s
const CAPTURE_INTERVAL_NORMAL_MS = 500   // Claude pane working/waiting
const CAPTURE_INTERVAL_IDLE_MS = 2000    // Non-Claude or stable
const CAPTURE_INTERVAL_BACKOFF_MS = 5000 // 5+ consecutive no-changes

// Thresholds
const ACTIVE_WINDOW_MS = 2000            // Consider "active" if changed within 2s
const BACKOFF_THRESHOLD = 5              // Start backoff after 5 no-changes

// Per-pane tracking for adaptive polling
const lastPaneCapture = new Map<string, number>()
const lastContentChange = new Map<string, number>()
const consecutiveNoChange = new Map<string, number>()
const lastTerminalContent = new Map<string, string>()

/**
 * Calculate capture interval for a pane based on activity state
 */
function getCaptureInterval(paneId: string, claudeStatus?: string): number {
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

  // Claude in working/waiting states gets normal interval
  if (claudeStatus === 'working' || claudeStatus === 'waiting') {
    return CAPTURE_INTERVAL_NORMAL_MS
  }

  // Everything else: idle interval
  return CAPTURE_INTERVAL_IDLE_MS
}

/**
 * Check if we should capture terminal for this pane
 */
function shouldCapturePane(paneId: string, claudeStatus?: string): boolean {
  const now = Date.now()
  const interval = getCaptureInterval(paneId, claudeStatus)
  const lastCapture = lastPaneCapture.get(paneId) || 0

  if (now - lastCapture >= interval) {
    lastPaneCapture.set(paneId, now)
    return true
  }
  return false
}

/**
 * Update adaptive tracking after capture
 */
function updateCaptureTracking(paneId: string, content: string): void {
  const previousContent = lastTerminalContent.get(paneId)
  const contentChanged = previousContent !== content

  if (contentChanged) {
    consecutiveNoChange.set(paneId, 0)
    lastContentChange.set(paneId, Date.now())
    lastTerminalContent.set(paneId, content)
  } else {
    const count = consecutiveNoChange.get(paneId) || 0
    consecutiveNoChange.set(paneId, count + 1)
  }
}

/**
 * Clean up tracking state for removed pane
 */
export function cleanupPaneTracking(paneId: string): void {
  lastPaneCapture.delete(paneId)
  lastContentChange.delete(paneId)
  consecutiveNoChange.delete(paneId)
  lastTerminalContent.delete(paneId)
}

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
    const windowsProc = Bun.spawn([
      'tmux', 'list-windows', '-a',
      '-F', '#{window_id}:#{session_name}:#{window_index}:#{window_name}:#{window_active}'
    ], { stdout: 'pipe' })
    await windowsProc.exited  // Wait for process to complete
    const windowsOutput = await new Response(windowsProc.stdout).text()
    const parsedWindows = parseWindows(windowsOutput)

    // Get panes
    const panesProc = Bun.spawn([
      'tmux', 'list-panes', '-a',
      '-F', '#{pane_id}:#{window_id}:#{pane_index}:#{pane_active}:#{pane_width}:#{pane_height}:#{pane_pid}:#{pane_current_command}'
    ], { stdout: 'pipe' })
    await panesProc.exited  // Wait for process to complete
    const panesOutput = await new Response(panesProc.stdout).text()
    const parsedPanes = parsePanes(panesOutput)

    // Enrich panes with process info
    const panes: (TmuxPane & { windowId: string })[] = await Promise.all(
      parsedPanes.map(async (p) => {
        const processType = await classifyProcess(p.pid) as PaneProcessType
        const cwd = await getProcessCwd(p.pid) || '/tmp'

        // Parse repo from cwd
        let repo: RepoInfo | undefined
        if (cwd) {
          const match = cwd.match(/\/([^\/]+)\/([^\/]+)$/)
          if (match) {
            repo = {
              path: cwd,
              org: match[1],
              name: match[2],
            }
          }
        }

        // Build ClaudeSessionInfo if this is a Claude process
        let claudeSession
        if (processType === 'claude') {
          claudeSession = await buildClaudeSessionInfo(p.paneId, undefined, cwd)
        }

        // Capture terminal content for Claude panes
        // Always capture - don't use adaptive backoff which causes stale content
        // V1 captured every 500ms and rate-limited broadcasts, not captures
        let terminalContent: string | undefined
        if (processType === 'claude') {
          try {
            const captureLines = getConfig().terminalCaptureLines
            terminalContent = await capturePane(p.paneId, captureLines)
            if (terminalContent) {
              updateCaptureTracking(p.paneId, terminalContent)
            }
          } catch (error) {
            log.debug('Failed to capture terminal content', {
              paneId: p.paneId,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        return {
          id: p.paneId,
          windowId: p.windowId,  // Keep for internal grouping
          index: p.paneIndex,
          active: p.active,
          width: p.width,
          height: p.height,
          process: {
            type: processType,
            command: p.command,
            pid: p.pid,
            claudeSession,
          },
          cwd,
          repo,
          terminalContent,
        }
      })
    )

    // Build windows with panes (use correct field names for client)
    const windows: TmuxWindow[] = parsedWindows.map(w => ({
      id: w.windowId,
      sessionName: w.sessionName,
      windowIndex: w.windowIndex,   // Renamed from 'index'
      windowName: w.windowName,     // Renamed from 'name'
      panes: panes
        .filter(p => p.windowId === w.windowId)
        .map(({ windowId, ...pane }) => pane),  // Remove internal windowId field
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
      // Attached status is not used by client or server logic, so hardcoded true is acceptable.
      // Could be retrieved with: tmux list-sessions -F '#{session_name}:#{session_attached}'
      attached: true,
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
