/**
 * Moltbook file watcher
 *
 * Watches moltbook activity directory for changes and broadcasts via WebSocket
 */

import { watch, existsSync, statSync } from 'fs'
import { join } from 'path'
import { createLogger } from '../lib/logger'
import { broadcast } from '../api/broadcast'
import { getMoltbookPaths, readActivityEvents, readHealthState } from './reader'
import type { ActivityEvent } from './types'

const log = createLogger('moltbook-watcher')

let watcher: ReturnType<typeof watch> | null = null
let lastActivitySize = 0
let lastActivityFile = ''

/**
 * Start watching moltbook files for changes
 */
export function startWatcher(): void {
  const paths = getMoltbookPaths()

  if (!existsSync(paths.activity)) {
    log.warn('Activity directory does not exist, watcher not started', {
      path: paths.activity,
    })
    return
  }

  // Initialize last known state
  updateLastKnownState(paths.activity)

  try {
    watcher = watch(paths.activity, { persistent: false }, (eventType, filename) => {
      if (!filename) return

      // Only watch feed files
      if (!filename.startsWith('feed-') || !filename.endsWith('.jsonl')) {
        return
      }

      log.debug('Activity file changed', { eventType, filename })

      // On change, check for new events
      handleActivityChange(paths.activity, filename)
    })

    log.info('Moltbook watcher started', { path: paths.activity })
  } catch (error) {
    log.error('Failed to start watcher', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Stop watching moltbook files
 */
export function stopWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
    log.info('Moltbook watcher stopped')
  }
}

/**
 * Update last known state for detecting new events
 */
function updateLastKnownState(activityDir: string): void {
  const today = new Date().toISOString().split('T')[0]
  const todayFile = `feed-${today}.jsonl`
  const filePath = join(activityDir, todayFile)

  if (existsSync(filePath)) {
    try {
      const stats = statSync(filePath)
      lastActivitySize = stats.size
      lastActivityFile = todayFile
    } catch {
      lastActivitySize = 0
      lastActivityFile = todayFile
    }
  } else {
    lastActivitySize = 0
    lastActivityFile = todayFile
  }
}

/**
 * Handle activity file change by detecting new events and broadcasting
 */
function handleActivityChange(activityDir: string, filename: string): void {
  const filePath = join(activityDir, filename)

  if (!existsSync(filePath)) {
    return
  }

  try {
    const stats = statSync(filePath)

    // If file is same or smaller (truncated/rotated), just update state
    if (filename === lastActivityFile && stats.size <= lastActivitySize) {
      lastActivitySize = stats.size
      return
    }

    // File grew or is new - fetch recent events and broadcast
    const events = readActivityEvents(5) // Get last 5 events

    if (events.length > 0) {
      // Broadcast each new event
      for (const event of events) {
        broadcastActivity(event)
      }

      log.debug('Broadcast new activity events', { count: events.length })
    }

    // Update state
    lastActivitySize = stats.size
    lastActivityFile = filename
  } catch (error) {
    log.error('Failed to handle activity change', {
      filename,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Broadcast a moltbook activity event via WebSocket
 */
function broadcastActivity(event: ActivityEvent): void {
  broadcast({
    type: 'moltbook_activity',
    payload: event,
  } as MoltbookActivityMessage)
}

/**
 * Broadcast current health state via WebSocket
 */
export function broadcastHealth(): void {
  const health = readHealthState()
  if (health) {
    broadcast({
      type: 'moltbook_health',
      payload: health,
    } as MoltbookHealthMessage)
  }
}

// WebSocket message types (to be added to messages.ts)
export interface MoltbookActivityMessage {
  type: 'moltbook_activity'
  payload: ActivityEvent
}

export interface MoltbookHealthMessage {
  type: 'moltbook_health'
  payload: {
    status: string
    timestamp: string
    orchestrator: unknown
    agents: unknown
    rate_limits: unknown
    api: unknown
  }
}
