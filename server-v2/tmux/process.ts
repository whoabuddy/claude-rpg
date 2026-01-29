/**
 * Process detection for tmux panes
 */

import { readlink, readFile } from 'fs/promises'
import { createLogger } from '../lib/logger'
import type { PaneProcessType, ProcessInfo } from './types'

const log = createLogger('process')

/**
 * Get process info from PID
 */
export async function getProcessInfo(pid: number): Promise<ProcessInfo | null> {
  try {
    // Read command line
    const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf-8')
    const parts = cmdline.split('\0').filter(Boolean)
    const command = parts[0] || ''
    const args = parts.slice(1)

    // Read working directory
    let cwd: string | null = null
    try {
      cwd = await readlink(`/proc/${pid}/cwd`)
    } catch {
      // Process may have exited or we don't have permission
    }

    return { pid, command, args, cwd }
  } catch {
    // Process doesn't exist or we can't read it
    return null
  }
}

/**
 * Get child processes of a PID
 */
export async function getChildPids(pid: number): Promise<number[]> {
  try {
    const result = await Bun.spawn(['pgrep', '-P', String(pid)], {
      stdout: 'pipe',
    })
    const output = await new Response(result.stdout).text()
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n))
  } catch {
    return []
  }
}

/**
 * Check if a process is Claude Code
 */
function isClaudeProcess(info: ProcessInfo): boolean {
  const cmd = info.command.toLowerCase()
  const fullCmd = [info.command, ...info.args].join(' ').toLowerCase()

  // Check for Claude Code patterns
  if (cmd.includes('claude') || cmd.includes('claude-code')) {
    return true
  }

  // Check for node/bun running claude
  if ((cmd.includes('node') || cmd.includes('bun')) &&
      (fullCmd.includes('claude') || fullCmd.includes('@anthropic'))) {
    return true
  }

  return false
}

/**
 * Classify a process by its PID
 */
export async function classifyProcess(pid: number): Promise<PaneProcessType> {
  const info = await getProcessInfo(pid)
  if (!info) {
    return 'idle'
  }

  // Check main process
  if (isClaudeProcess(info)) {
    return 'claude'
  }

  // Check if it's a shell
  const cmd = info.command.toLowerCase()
  const shellNames = ['bash', 'zsh', 'sh', 'fish', 'tcsh', 'csh']
  const isShell = shellNames.some(s => cmd.endsWith(s) || cmd.endsWith(`/${s}`))

  if (isShell) {
    // Check children for Claude
    const childPids = await getChildPids(pid)
    for (const childPid of childPids) {
      const childInfo = await getProcessInfo(childPid)
      if (childInfo && isClaudeProcess(childInfo)) {
        return 'claude'
      }
    }
    return 'shell'
  }

  // Some other process running
  return 'process'
}

/**
 * Get working directory for a pane's process
 */
export async function getProcessCwd(pid: number): Promise<string | null> {
  // First check the main process
  const info = await getProcessInfo(pid)
  if (info?.cwd) {
    return info.cwd
  }

  // Check children
  const childPids = await getChildPids(pid)
  for (const childPid of childPids) {
    const childInfo = await getProcessInfo(childPid)
    if (childInfo?.cwd) {
      return childInfo.cwd
    }
  }

  return null
}
