/**
 * State Reconciliation for Claude Sessions
 *
 * Cross-checks hook-reported state with terminal content to detect
 * and fix state drift (when hooks are missed or terminal changes unexpectedly).
 */

import type { TmuxPane, ClaudeSessionInfo, SessionStatus } from '../shared/types.js'
import type { TerminalPrompt } from './terminal-parser.js'
import { parseTerminalForPrompt } from './terminal-parser.js'

export interface ReconciliationResult {
  stateChanged: boolean
  newStatus?: SessionStatus
  newPrompt?: TerminalPrompt | null
  clearPrompt?: boolean
  confidence: 'high' | 'medium' | 'low'
  reason?: string
}

// Strip ANSI escape codes for cleaner analysis
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

/**
 * Infer session state from terminal content patterns
 */
export function inferStateFromTerminal(content: string): 'idle' | 'working' | 'waiting' | 'unknown' {
  if (!content) return 'unknown'

  const cleaned = stripAnsi(content)
  const lines = cleaned.trim().split('\n')

  // Get last few non-empty lines for analysis
  const lastLines = lines.filter(l => l.trim()).slice(-5)
  const lastLine = lastLines[lastLines.length - 1]?.trim() || ''

  // Check for Claude waiting indicators (prompts)
  // These patterns indicate Claude is waiting for user input
  const waitingPatterns = [
    /Do you want to proceed\?/i,
    /Allow:.*Deny:/i,
    /\(\d+\).*\(Recommended\)/i,      // Option selection
    /●.*\(\d+\)/,                      // Radio button options
    /○.*\(\d+\)/,                      // Radio button options
    /Press.*to continue/i,
  ]

  for (const pattern of waitingPatterns) {
    if (pattern.test(cleaned)) {
      return 'waiting'
    }
  }

  // Check for Claude working indicators
  const workingPatterns = [
    /Thinking\.\.\./i,
    /Working\.\.\./i,
    /Reading\s+\S+\.\.\./i,
    /Writing\s+\S+\.\.\./i,
    /Searching\.\.\./i,
    /Analyzing\.\.\./i,
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,         // Braille spinner characters
    /✶|✻|✽|✢|\*/,                      // Star/asterisk spinners
    /Garnishing/i,                      // Claude Code specific
  ]

  for (const pattern of workingPatterns) {
    if (pattern.test(cleaned)) {
      return 'working'
    }
  }

  // Check for shell prompt (indicates Claude exited or session ended)
  const shellPromptPatterns = [
    /^[❯›>$#%]\s*$/,                   // Simple prompts
    /^\w+@[\w-]+.*[#$%>]\s*$/,         // user@host prompts
    /^\(\w+\).*[#$%>]\s*$/,            // (venv) prompts
    /^\[.*\]\s*[#$%>]\s*$/,            // [directory] prompts
  ]

  for (const pattern of shellPromptPatterns) {
    if (pattern.test(lastLine)) {
      return 'idle'
    }
  }

  // Check for Claude idle state (ready for input)
  // Claude Code shows ">" prompt when ready
  const claudeIdlePatterns = [
    /^>\s*$/,                          // Just ">"
    /^>\s+$/,                          // "> " with space
  ]

  for (const pattern of claudeIdlePatterns) {
    if (pattern.test(lastLine)) {
      return 'idle'
    }
  }

  return 'unknown'
}

/**
 * Reconcile session state between hook-reported state and terminal content.
 * Returns reconciliation result if state needs to be updated.
 */
export function reconcileSessionState(
  pane: TmuxPane,
  terminalContent: string,
  hookState: ClaudeSessionInfo
): ReconciliationResult {
  const terminalPrompt = parseTerminalForPrompt(terminalContent)
  const terminalState = inferStateFromTerminal(terminalContent)
  const now = Date.now()

  // Case 1: Terminal shows prompt, hook says working
  // Trust terminal - a prompt is visible, user should respond
  if (terminalPrompt && hookState.status === 'working') {
    return {
      stateChanged: true,
      newStatus: 'waiting',
      newPrompt: terminalPrompt,
      confidence: 'high',
      reason: 'Terminal shows prompt but hook reported working',
    }
  }

  // Case 2: Terminal shows prompt, hook says idle
  // Trust terminal - prompt appeared, maybe hook was missed
  if (terminalPrompt && hookState.status === 'idle') {
    return {
      stateChanged: true,
      newStatus: 'waiting',
      newPrompt: terminalPrompt,
      confidence: 'high',
      reason: 'Terminal shows prompt but hook reported idle',
    }
  }

  // Case 3: Hook says waiting but no prompt visible in terminal
  // The prompt may have been answered and we missed the post_tool_use hook
  if (!terminalPrompt && hookState.status === 'waiting') {
    const questionTimestamp = hookState.pendingQuestion?.timestamp || hookState.lastActivity
    const timeSinceQuestion = now - questionTimestamp

    // Wait a bit before reconciling to avoid race conditions
    if (timeSinceQuestion > 2000) {
      // Check what the terminal actually shows
      if (terminalState === 'working') {
        return {
          stateChanged: true,
          newStatus: 'working',
          clearPrompt: true,
          confidence: 'medium',
          reason: 'Terminal shows working but hook reported waiting (prompt answered)',
        }
      } else if (terminalState === 'idle') {
        return {
          stateChanged: true,
          newStatus: 'idle',
          clearPrompt: true,
          confidence: 'medium',
          reason: 'Terminal shows idle but hook reported waiting (session ended?)',
        }
      }
    }
  }

  // Case 4: Hook says working but terminal shows idle for a while
  // Claude may have finished and we missed the Stop hook
  if (hookState.status === 'working' && terminalState === 'idle') {
    const timeSinceActivity = now - hookState.lastActivity

    // Only reconcile if no activity for 5 seconds
    if (timeSinceActivity > 5000) {
      return {
        stateChanged: true,
        newStatus: 'idle',
        confidence: 'medium',
        reason: 'Terminal shows idle, no hook activity for 5s',
      }
    }
  }

  // Case 5: Hook says error but terminal shows working or idle
  // Error state might be stale
  if (hookState.status === 'error') {
    const errorTimestamp = hookState.lastError?.timestamp || hookState.lastActivity
    const timeSinceError = now - errorTimestamp

    if (timeSinceError > 10000) { // 10 seconds
      if (terminalState === 'working') {
        return {
          stateChanged: true,
          newStatus: 'working',
          confidence: 'low',
          reason: 'Stale error state, terminal shows working',
        }
      } else if (terminalState === 'idle') {
        return {
          stateChanged: true,
          newStatus: 'idle',
          confidence: 'low',
          reason: 'Stale error state, terminal shows idle',
        }
      }
    }
  }

  // No reconciliation needed
  return { stateChanged: false, confidence: 'high' }
}

/**
 * Check if Claude is likely running in this pane based on terminal content.
 * Useful for detecting Claude instances that started before hooks were set up.
 */
export function detectClaudeFromTerminal(content: string): boolean {
  if (!content) return false

  const cleaned = stripAnsi(content)

  // Claude-specific patterns
  const claudePatterns = [
    /claude\s+\d+\.\d+/i,              // Version string
    /╭─.*Claude.*─╮/i,                 // Claude header box
    /Anthropic/i,                       // Company name
    /\[claude-code\]/i,                 // Claude code identifier
    /Thinking\.\.\./i,                  // Thinking indicator
    /Garnishing/i,                      // Claude-specific
    /●.*\(\d+\).*○/,                   // Radio button UI
  ]

  for (const pattern of claudePatterns) {
    if (pattern.test(cleaned)) {
      return true
    }
  }

  return false
}
