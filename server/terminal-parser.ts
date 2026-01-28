/**
 * Terminal prompt parser for Claude Code TUI
 *
 * Detects prompts in terminal content:
 * - Permission prompts (Bash, Edit, Write confirmations)
 * - Question prompts (AskUserQuestion multi-option)
 * - Plan approval prompts (ExitPlanMode)
 *
 * This is the source of truth for prompt state - terminal shows actual current prompt.
 */

import { stripAnsi, simpleHash } from './utils.js'
import type { TerminalPrompt, TerminalPromptOption } from '../shared/types.js'

export type { TerminalPrompt, TerminalPromptOption }

/**
 * Parse terminal content for Claude Code prompts
 *
 * Returns TerminalPrompt if a prompt is detected, null otherwise.
 */
export function parseTerminalForPrompt(content: string): TerminalPrompt | null {
  if (!content) return null

  const cleaned = stripAnsi(content)
  const lines = cleaned.split('\n')

  // Look for prompts from bottom up (most recent)
  // Reverse to find the most recent prompt first
  const reversedLines = [...lines].reverse()

  // Check for permission prompts first (most common)
  const permissionPrompt = parsePermissionPrompt(reversedLines)
  if (permissionPrompt) return permissionPrompt

  // Check for feedback prompts (Anthropic feedback)
  const feedbackPrompt = parseFeedbackPrompt(reversedLines)
  if (feedbackPrompt) return feedbackPrompt

  // Check for question prompts (AskUserQuestion)
  const questionPrompt = parseQuestionPrompt(reversedLines)
  if (questionPrompt) return questionPrompt

  // Check for plan approval prompts
  const planPrompt = parsePlanApprovalPrompt(reversedLines)
  if (planPrompt) return planPrompt

  // Check for selector-style prompts (arrow navigation)
  const selectorPrompt = parseSelectorPrompt(reversedLines)
  if (selectorPrompt) return selectorPrompt

  return null
}

/**
 * Parse permission prompts like:
 * ┌─ Bash ─────────────────────────────────────────────────────────────────────┐
 * │ npm run build                                                              │
 * ├────────────────────────────────────────────────────────────────────────────┤
 * │ Do you want to proceed?                                                    │
 * │ Allow: y | Deny: n | Always allow: ! | Always deny: * | Skip: s           │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
function parsePermissionPrompt(reversedLines: string[]): TerminalPrompt | null {
  // Find the box boundaries from bottom up
  let foundBottomBorder = false
  let foundTopBorder = false
  let toolName = ''
  let command = ''
  let hasAllowDeny = false
  let boxContent: string[] = []

  for (const line of reversedLines) {
    const trimmed = line.trim()

    // Bottom border
    if (trimmed.startsWith('└') && trimmed.includes('─') && trimmed.endsWith('┘')) {
      foundBottomBorder = true
      boxContent = []
      continue
    }

    // Collect lines inside the box
    if (foundBottomBorder && !foundTopBorder) {
      // Top border with tool name: ┌─ Bash ─┐
      const topMatch = trimmed.match(/^┌─\s*(\w+)\s*─/)
      if (topMatch) {
        foundTopBorder = true
        toolName = topMatch[1]
        break
      }

      // Content line
      if (trimmed.startsWith('│') && trimmed.endsWith('│')) {
        const content = trimmed.slice(1, -1).trim()
        boxContent.unshift(content) // Restore original order

        // Check for Allow/Deny options
        if (content.includes('Allow:') && content.includes('Deny:')) {
          hasAllowDeny = true
        }
      }

      // Middle border (separator)
      if (trimmed.startsWith('├') && trimmed.includes('─') && trimmed.endsWith('┤')) {
        continue
      }
    }
  }

  // Must have found complete box with Allow/Deny
  if (!foundTopBorder || !foundBottomBorder || !hasAllowDeny) {
    return null
  }

  // Only match known permission tools
  const permissionTools = ['Bash', 'Edit', 'Write', 'NotebookEdit']
  if (!permissionTools.includes(toolName)) {
    return null
  }

  // Extract command (first content line that's not the question or options)
  for (const line of boxContent) {
    if (!line.includes('Do you want to proceed?') &&
        !line.includes('Allow:') &&
        !line.includes('Deny:') &&
        line.trim().length > 0) {
      command = line.trim()
      break
    }
  }

  // Parse options from the Allow/Deny line
  const options: TerminalPromptOption[] = []
  for (const line of boxContent) {
    if (line.includes('Allow:') && line.includes('Deny:')) {
      // Parse: Allow: y | Deny: n | Always allow: ! | Always deny: * | Skip: s
      const parts = line.split('|').map(p => p.trim())
      for (const part of parts) {
        const match = part.match(/^([^:]+):\s*(\S+)$/)
        if (match) {
          options.push({
            label: match[1].trim(),
            key: match[2].trim(),
          })
        }
      }
      break
    }
  }

  return {
    type: 'permission',
    tool: toolName,
    command: command || undefined,
    question: 'Do you want to proceed?',
    options,
    multiSelect: false,
    footer: 'Esc to cancel',
    detectedAt: Date.now(),
    contentHash: simpleHash(boxContent.join('\n')),
  }
}

/**
 * Parse feedback prompts from Anthropic like:
 * ● How would you rate this response?
 * 1: Bad    2: Fine   3: Good   0: Dismiss
 */
function parseFeedbackPrompt(reversedLines: string[]): TerminalPrompt | null {
  const lines = [...reversedLines].reverse() // Restore original order

  // Look for feedback pattern from bottom up
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()

    // Match line starting with ● followed by question text
    if (line.startsWith('●') && line.includes('?')) {
      const question = line.slice(1).trim()

      // Check next line for options with "N: Label" format
      if (i + 1 < lines.length) {
        const optionsLine = lines[i + 1].trim()
        const options: TerminalPromptOption[] = []

        // Parse options: "1: Bad    2: Fine   3: Good   0: Dismiss"
        // Pattern: digit followed by colon and label
        const optionPattern = /(\d+):\s*(\w+)/g
        let match: RegExpExecArray | null

        while ((match = optionPattern.exec(optionsLine)) !== null) {
          options.push({
            label: match[2],
            key: match[1],
          })
        }

        // Must have at least 2 options to be valid
        if (options.length >= 2) {
          return {
            type: 'feedback',
            question,
            options,
            multiSelect: false,
            detectedAt: Date.now(),
            contentHash: simpleHash(question + optionsLine),
          }
        }
      }
    }
  }

  return null
}

/**
 * Parse question prompts (AskUserQuestion) like:
 * ┌─ Question ─────────────────────────────────────────────────────────────────┐
 * │ Which testing framework should we use?                                     │
 * │                                                                            │
 * │ ● (1) Vitest (Recommended)                                                │
 * │   Modern, fast, built-in TypeScript support                               │
 * │ ○ (2) Jest                                                                │
 * │   Traditional, widely used                                                │
 * │ ○ (3) Other                                                               │
 * │   Specify a different option                                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
function parseQuestionPrompt(reversedLines: string[]): TerminalPrompt | null {
  let foundBottomBorder = false
  let foundTopBorder = false
  let boxContent: string[] = []
  let headerText = ''

  for (const line of reversedLines) {
    const trimmed = line.trim()

    // Bottom border
    if (trimmed.startsWith('└') && trimmed.includes('─') && trimmed.endsWith('┘')) {
      foundBottomBorder = true
      boxContent = []
      continue
    }

    // Collect lines inside the box
    if (foundBottomBorder && !foundTopBorder) {
      // Top border: ┌─ Question ─┐ or ┌─ Header Text ─┐
      const topMatch = trimmed.match(/^┌─\s*(.+?)\s*─+┐$/)
      if (topMatch) {
        foundTopBorder = true
        headerText = topMatch[1].trim()
        break
      }

      // Content line
      if (trimmed.startsWith('│') && trimmed.endsWith('│')) {
        const content = trimmed.slice(1, -1).trim()
        boxContent.unshift(content)
      }
    }
  }

  if (!foundTopBorder || !foundBottomBorder) {
    return null
  }

  // Must have numbered options (1), (2), etc. or bullet points
  const hasNumberedOptions = boxContent.some(line =>
    /[●○]\s*\(\d+\)/.test(line) || /^\(\d+\)/.test(line.trim())
  )

  if (!hasNumberedOptions) {
    return null
  }

  // Extract question (first non-empty line before options)
  let question = ''
  const options: TerminalPromptOption[] = []
  let multiSelect = false

  for (const line of boxContent) {
    // Check for multi-select indicator
    if (line.includes('[ ]') || line.includes('[x]')) {
      multiSelect = true
    }

    // Parse option: ● (1) Label or ○ (2) Label or (1) Label
    const optionMatch = line.match(/[●○□■]?\s*\((\d+)\)\s*(.+)/)
    if (optionMatch) {
      options.push({
        label: optionMatch[2].trim(),
        key: optionMatch[1],
      })
      continue
    }

    // Question text (before options start)
    if (options.length === 0 && line.trim() && !line.trim().startsWith('●') && !line.trim().startsWith('○')) {
      if (question) {
        question += ' ' + line.trim()
      } else {
        question = line.trim()
      }
    }
  }

  if (options.length === 0) {
    return null
  }

  return {
    type: 'question',
    question: question || headerText,
    options,
    multiSelect,
    footer: 'Tab to add context',
    detectedAt: Date.now(),
    contentHash: simpleHash(boxContent.join('\n')),
  }
}

/**
 * Parse plan approval prompts like:
 * ┌─ Plan Complete ────────────────────────────────────────────────────────────┐
 * │ Your plan is ready for approval.                                           │
 * │                                                                            │
 * │ ● (1) Yes, and manually approve edits (Recommended)                       │
 * │ ○ (2) Yes, and bypass permissions                                         │
 * │ ○ (3) No, continue planning                                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
function parsePlanApprovalPrompt(reversedLines: string[]): TerminalPrompt | null {
  // Plan approval is essentially a question prompt with specific patterns
  const questionPrompt = parseQuestionPrompt(reversedLines)

  if (!questionPrompt) return null

  // Check if this looks like a plan approval
  const isPlanApproval = questionPrompt.question.toLowerCase().includes('plan') ||
    questionPrompt.options.some(o =>
      o.label.toLowerCase().includes('approve') ||
      o.label.toLowerCase().includes('bypass permissions') ||
      o.label.toLowerCase().includes('manually approve')
    )

  if (!isPlanApproval) return null

  return {
    ...questionPrompt,
    type: 'plan',
  }
}

/**
 * Parse selector-style prompts with arrow navigation like:
 * What would you like to do?
 *   ❯ 1. Continue with current plan
 *     2. Revise the plan
 *     3. Start over
 *
 * ctrl-g to edit | enter to submit
 */
function parseSelectorPrompt(reversedLines: string[]): TerminalPrompt | null {
  const lines = [...reversedLines].reverse() // Restore original order

  let question = ''
  const options: TerminalPromptOption[] = []
  let selectedIndex: number | undefined
  let footer = ''
  let inPromptBlock = false
  let promptStartIndex = -1

  // Scan for selector pattern from bottom up
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const trimmed = line.trim()

    // Look for footer first (indicates we're at the end of a prompt)
    if (trimmed.match(/ctrl-[a-z].*\|.*enter/i)) {
      footer = trimmed
      inPromptBlock = true
      promptStartIndex = i
      continue
    }

    if (inPromptBlock) {
      // Check for selected option: ❯ N. Label or › N. Label or > N. Label
      const selectedMatch = trimmed.match(/^[❯›>]\s*(\d+)\.\s*(.+)$/)
      if (selectedMatch) {
        const optionNumber = parseInt(selectedMatch[1], 10)
        selectedIndex = options.length
        options.unshift({
          label: selectedMatch[2].trim(),
          key: optionNumber.toString(),
        })
        continue
      }

      // Check for unselected option: N. Label (with leading spaces)
      const unselectedMatch = trimmed.match(/^(\d+)\.\s*(.+)$/)
      if (unselectedMatch) {
        const optionNumber = parseInt(unselectedMatch[1], 10)
        options.unshift({
          label: unselectedMatch[2].trim(),
          key: optionNumber.toString(),
        })
        continue
      }

      // If we have options and hit non-option text, it's the question
      if (options.length > 0 && trimmed.length > 0 && !trimmed.match(/^\d+\./)) {
        question = trimmed
        break
      }
    }
  }

  // Must have found options with footer
  if (options.length === 0 || !footer) {
    return null
  }

  // Determine type based on footer content
  const isPlanPrompt = footer.toLowerCase().includes('ctrl-g to edit')
  const type = isPlanPrompt ? 'plan' : 'question'

  // Build content hash including selectedIndex
  const hashContent = [
    question,
    ...options.map(o => o.label),
    selectedIndex?.toString() ?? '',
    footer,
  ].join('\n')

  return {
    type,
    question: question || 'Select an option',
    options,
    multiSelect: false,
    selectedIndex,
    footer,
    detectedAt: Date.now(),
    contentHash: simpleHash(hashContent),
  }
}

/**
 * Parse token count from Claude Code's terminal output (#31)
 * Matches patterns like: "↓ 879 tokens", "↓ 12.5k tokens", "↓ 1.2m tokens"
 */
export function parseTokenCount(content: string): number | null {
  if (!content) return null

  const cleaned = stripAnsi(content)
  // Search from the end of output (most recent)
  const match = cleaned.match(/↓\s*([\d.]+)([km]?)\s*tokens/i)
  if (!match) return null

  let value = parseFloat(match[1])
  const suffix = match[2]?.toLowerCase()
  if (suffix === 'k') value *= 1000
  if (suffix === 'm') value *= 1000000

  return Math.round(value)
}

/**
 * Check if terminal content has changed enough to warrant re-parsing
 */
export function hasPromptChanged(
  oldPrompt: TerminalPrompt | null,
  newPrompt: TerminalPrompt | null
): boolean {
  if (!oldPrompt && !newPrompt) return false
  if (!oldPrompt || !newPrompt) return true
  return oldPrompt.contentHash !== newPrompt.contentHash
}
