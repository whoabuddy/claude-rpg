/**
 * Terminal content parser for Claude Code detection
 */

import { createLogger } from '../lib/logger'
import {
  WAITING_PATTERNS,
  WORKING_PATTERNS,
  IDLE_PATTERNS,
  ERROR_PATTERNS,
  OPTION_PATTERNS,
} from './patterns'
import type { TerminalDetection, DetectedPrompt, PromptType } from './types'

const log = createLogger('terminal-parser')

const MAX_LINES = 50

/**
 * Parse terminal content to detect Claude state
 */
export function parseTerminal(content: string): TerminalDetection {
  if (!content || content.trim().length === 0) {
    return {
      status: 'unknown',
      confidence: 0,
    }
  }

  // Get last N lines
  const lines = content.split('\n')
  const relevantContent = lines.slice(-MAX_LINES).join('\n')

  // Check patterns in priority order
  const errorMatch = matchPatterns(relevantContent, ERROR_PATTERNS)
  if (errorMatch && errorMatch.confidence > 0.7) {
    return {
      status: 'error',
      confidence: errorMatch.confidence,
      error: extractErrorMessage(relevantContent),
      matchedPattern: errorMatch.name,
    }
  }

  const waitingMatch = matchPatterns(relevantContent, WAITING_PATTERNS)
  if (waitingMatch && waitingMatch.confidence > 0.6) {
    return {
      status: 'waiting',
      confidence: waitingMatch.confidence,
      prompt: extractPrompt(relevantContent, waitingMatch.name),
      matchedPattern: waitingMatch.name,
    }
  }

  const workingMatch = matchPatterns(relevantContent, WORKING_PATTERNS)
  if (workingMatch && workingMatch.confidence > 0.5) {
    return {
      status: 'working',
      confidence: workingMatch.confidence,
      matchedPattern: workingMatch.name,
    }
  }

  const idleMatch = matchPatterns(relevantContent, IDLE_PATTERNS)
  if (idleMatch && idleMatch.confidence > 0.4) {
    return {
      status: 'idle',
      confidence: idleMatch.confidence,
      matchedPattern: idleMatch.name,
    }
  }

  // Unknown state
  return {
    status: 'unknown',
    confidence: 0.3,
  }
}

/**
 * Match content against a set of patterns
 */
function matchPatterns(
  content: string,
  patterns: Array<{ name: string; regex: RegExp; confidence: number }>
): { name: string; confidence: number } | null {
  let bestMatch: { name: string; confidence: number } | null = null

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      if (!bestMatch || pattern.confidence > bestMatch.confidence) {
        bestMatch = { name: pattern.name, confidence: pattern.confidence }
      }
    }
  }

  return bestMatch
}

/**
 * Extract prompt details from terminal content
 */
function extractPrompt(content: string, patternName: string): DetectedPrompt {
  const type = getPromptType(patternName)

  // Extract prompt text (last significant line before options)
  const lines = content.split('\n').filter(l => l.trim())
  const lastLines = lines.slice(-10)

  let text = ''
  for (const line of lastLines) {
    if (line.includes('?') || WAITING_PATTERNS.some(p => p.regex.test(line))) {
      text = line.trim()
      break
    }
  }

  // Extract options if present
  const options = extractOptions(content)

  return {
    type,
    text: text || 'Waiting for input',
    options: options.length > 0 ? options : undefined,
  }
}

/**
 * Determine prompt type from pattern name
 */
function getPromptType(patternName: string): PromptType {
  if (patternName.includes('permission')) return 'permission'
  if (patternName.includes('plan')) return 'plan'
  if (patternName.includes('question') || patternName.includes('choice')) return 'question'
  return 'feedback'
}

/**
 * Extract options from terminal content
 */
function extractOptions(content: string): string[] {
  const options: string[] = []

  // Try numbered options
  let match
  while ((match = OPTION_PATTERNS.numbered.exec(content)) !== null) {
    options.push(match[2])
  }

  if (options.length > 0) return options

  // Try bulleted options
  OPTION_PATTERNS.bulleted.lastIndex = 0
  while ((match = OPTION_PATTERNS.bulleted.exec(content)) !== null) {
    options.push(match[1])
  }

  if (options.length > 0) return options

  // Try arrowed options
  OPTION_PATTERNS.arrowed.lastIndex = 0
  while ((match = OPTION_PATTERNS.arrowed.exec(content)) !== null) {
    options.push(match[1])
  }

  return options
}

/**
 * Extract error message from terminal content
 */
function extractErrorMessage(content: string): string {
  const lines = content.split('\n')

  for (const line of lines.reverse()) {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(line)) {
        return line.trim()
      }
    }
  }

  return 'Unknown error'
}
