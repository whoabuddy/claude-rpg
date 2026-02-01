/**
 * Tmux command wrappers
 */

import { createLogger } from '../lib/logger'

const log = createLogger('tmux')

/**
 * Execute a tmux command
 */
async function tmux(...args: string[]): Promise<string> {
  log.debug('Executing tmux command', { args })

  const proc = Bun.spawn(['tmux', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Must await exited before checking exitCode
  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()

  if (exitCode !== 0) {
    throw new Error(`tmux command failed: ${stderr || stdout}`)
  }

  return stdout
}

/**
 * Check if tmux server is running
 */
export async function isTmuxRunning(): Promise<boolean> {
  try {
    await tmux('list-sessions')
    return true
  } catch {
    return false
  }
}

/**
 * Send keys to a pane
 * @param submit - If true, send Enter after text
 */
export async function sendKeys(paneId: string, text: string, submit = true): Promise<void> {
  // Escape special characters for tmux
  await tmux('send-keys', '-t', paneId, text)
  if (submit) {
    await tmux('send-keys', '-t', paneId, 'Enter')
  }
}

/**
 * Send Enter key to a pane
 */
export async function sendEnter(paneId: string): Promise<void> {
  await tmux('send-keys', '-t', paneId, 'Enter')
}

/**
 * Send keys with Enter
 */
export async function sendKeysEnter(paneId: string, text: string): Promise<void> {
  await sendKeys(paneId, text)
  await sendEnter(paneId)
}

/**
 * Send Escape key to a pane
 */
export async function sendEscape(paneId: string): Promise<void> {
  await tmux('send-keys', '-t', paneId, 'Escape')
}

/**
 * Send Ctrl+C (interrupt) to a pane
 */
export async function sendInterrupt(paneId: string): Promise<void> {
  await tmux('send-keys', '-t', paneId, 'C-c')
}

/**
 * Capture pane content
 * @param lines - Number of lines to capture (default 150, configurable via TERMINAL_CAPTURE_LINES)
 */
export async function capturePane(paneId: string, lines = 150): Promise<string> {
  const output = await tmux(
    'capture-pane', '-t', paneId,
    '-p',           // Print to stdout
    '-e',           // Include escape sequences (colors)
    '-S', `-${lines}`,  // Start from N lines ago
    '-E', '-1'      // End at last line
  )
  return output
}

/**
 * Create a new window
 */
export async function createWindow(sessionName: string, windowName?: string): Promise<string> {
  const args = ['new-window', '-t', sessionName, '-P', '-F', '#{window_id}']
  if (windowName) {
    args.push('-n', windowName)
  }
  const output = await tmux(...args)
  return output.trim()
}

/**
 * Create a new pane (split)
 */
export async function createPane(windowId: string): Promise<string> {
  const output = await tmux(
    'split-window', '-t', windowId,
    '-P', '-F', '#{pane_id}'
  )
  return output.trim()
}

/**
 * Close/kill a pane
 */
export async function closePane(paneId: string): Promise<void> {
  await tmux('kill-pane', '-t', paneId)
}

/**
 * Close/kill a window
 */
export async function closeWindow(windowId: string): Promise<void> {
  await tmux('kill-window', '-t', windowId)
}

/**
 * Rename a window
 */
export async function renameWindow(windowId: string, name: string): Promise<void> {
  await tmux('rename-window', '-t', windowId, name)
}

/**
 * Scroll pane to bottom
 */
export async function scrollToBottom(paneId: string): Promise<void> {
  await tmux('copy-mode', '-t', paneId)
  await tmux('send-keys', '-t', paneId, 'G')
  await tmux('send-keys', '-t', paneId, 'q')
}
