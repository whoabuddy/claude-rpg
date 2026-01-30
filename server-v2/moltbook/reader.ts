/**
 * Moltbook file reader
 *
 * Reads and parses moltbook state files from ~/.local/ directory
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { createLogger } from '../lib/logger'
import type {
  ActivityEvent,
  HealthState,
  OrchestratorState,
  RelationshipsData,
} from './types'

const log = createLogger('moltbook-reader')

// Moltbook repo path
const MOLTBOOK_PATH = join(process.env.HOME || '~', 'dev/whoabuddy/moltbook')
const LOCAL_PATH = join(MOLTBOOK_PATH, '.local')

/**
 * Read activity events from JSONL files
 *
 * @param limit Maximum number of events to return
 * @param date Optional specific date (YYYY-MM-DD), defaults to today
 */
export function readActivityEvents(limit = 50, date?: string): ActivityEvent[] {
  const activityDir = join(LOCAL_PATH, 'activity')

  if (!existsSync(activityDir)) {
    log.warn('Activity directory not found', { path: activityDir })
    return []
  }

  // Get feed files, sorted by date descending
  const files = readdirSync(activityDir)
    .filter((f) => f.startsWith('feed-') && f.endsWith('.jsonl'))
    .sort()
    .reverse()

  if (files.length === 0) {
    log.debug('No activity feed files found')
    return []
  }

  // If specific date requested, filter to that file
  const targetFiles = date
    ? files.filter((f) => f.includes(date))
    : files

  if (targetFiles.length === 0) {
    log.debug('No activity files for date', { date })
    return []
  }

  const events: ActivityEvent[] = []

  for (const file of targetFiles) {
    if (events.length >= limit) break

    const filePath = join(activityDir, file)
    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      // Parse lines in reverse (most recent first)
      for (let i = lines.length - 1; i >= 0; i--) {
        if (events.length >= limit) break

        try {
          const event = JSON.parse(lines[i]) as ActivityEvent
          events.push(event)
        } catch (parseError) {
          log.warn('Failed to parse activity line', {
            file,
            line: i,
            error: parseError instanceof Error ? parseError.message : String(parseError),
          })
        }
      }
    } catch (error) {
      log.error('Failed to read activity file', {
        file,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return events
}

/**
 * Read current health state
 */
export function readHealthState(): HealthState | null {
  const healthPath = join(LOCAL_PATH, 'metrics/health.json')

  if (!existsSync(healthPath)) {
    log.debug('Health file not found', { path: healthPath })
    return null
  }

  try {
    const content = readFileSync(healthPath, 'utf-8')
    return JSON.parse(content) as HealthState
  } catch (error) {
    log.error('Failed to read health file', {
      path: healthPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Read orchestrator state
 */
export function readOrchestratorState(): OrchestratorState | null {
  const statePath = join(LOCAL_PATH, 'state/orchestrator.json')

  if (!existsSync(statePath)) {
    log.debug('Orchestrator state file not found', { path: statePath })
    return null
  }

  try {
    const content = readFileSync(statePath, 'utf-8')
    return JSON.parse(content) as OrchestratorState
  } catch (error) {
    log.error('Failed to read orchestrator state', {
      path: statePath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Read agent relationships data
 */
export function readRelationships(): RelationshipsData | null {
  const relPath = join(MOLTBOOK_PATH, 'relationships/agents.json')

  if (!existsSync(relPath)) {
    log.debug('Relationships file not found', { path: relPath })
    return null
  }

  try {
    const content = readFileSync(relPath, 'utf-8')
    return JSON.parse(content) as RelationshipsData
  } catch (error) {
    log.error('Failed to read relationships file', {
      path: relPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Get the current date in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get moltbook paths for file watching
 */
export function getMoltbookPaths() {
  return {
    moltbook: MOLTBOOK_PATH,
    local: LOCAL_PATH,
    activity: join(LOCAL_PATH, 'activity'),
    metrics: join(LOCAL_PATH, 'metrics'),
    state: join(LOCAL_PATH, 'state'),
    relationships: join(MOLTBOOK_PATH, 'relationships'),
  }
}
