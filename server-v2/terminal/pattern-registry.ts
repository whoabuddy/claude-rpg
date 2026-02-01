/**
 * Pattern registry for versioned terminal pattern sets
 *
 * This module provides versioned pattern sets for detecting Claude Code states.
 * When Claude Code's terminal UI changes, create a new pattern version and
 * update the CURRENT_VERSION pointer.
 */

import type { Pattern } from './patterns'
import {
  WAITING_PATTERNS,
  WORKING_PATTERNS,
  IDLE_PATTERNS,
  ERROR_PATTERNS,
} from './patterns'

/**
 * A versioned set of terminal patterns
 */
export interface PatternVersion {
  /** Semantic version of this pattern set */
  version: string
  /** Claude Code version this pattern set works with */
  claudeCodeVersion: string
  /** When this pattern set was created */
  createdAt: string
  /** Pattern sets for each status */
  patterns: {
    waiting: Pattern[]
    working: Pattern[]
    idle: Pattern[]
    error: Pattern[]
  }
}

/**
 * All pattern versions, sorted newest to oldest
 */
const PATTERN_VERSIONS: PatternVersion[] = [
  {
    version: '1.0.0',
    claudeCodeVersion: '1.x (Jan 2026)',
    createdAt: '2026-01-31',
    patterns: {
      waiting: WAITING_PATTERNS,
      working: WORKING_PATTERNS,
      idle: IDLE_PATTERNS,
      error: ERROR_PATTERNS,
    },
  },
]

/**
 * Current active pattern version (always the latest)
 */
const CURRENT_VERSION = '1.0.0'

/**
 * Get a specific pattern version by version string
 */
export function getPatternVersion(version: string): PatternVersion | null {
  return PATTERN_VERSIONS.find(v => v.version === version) ?? null
}

/**
 * Get the current (latest) pattern version
 */
export function getCurrentPatterns(): PatternVersion {
  const current = PATTERN_VERSIONS.find(v => v.version === CURRENT_VERSION)
  if (!current) {
    throw new Error(`Current pattern version ${CURRENT_VERSION} not found in registry`)
  }
  return current
}

/**
 * Get all available pattern versions
 */
export function getAllPatternVersions(): PatternVersion[] {
  return [...PATTERN_VERSIONS]
}

/**
 * Get pattern set for a specific status from current version
 */
export function getPatterns(status: 'waiting' | 'working' | 'idle' | 'error'): Pattern[] {
  const current = getCurrentPatterns()
  return current.patterns[status]
}
