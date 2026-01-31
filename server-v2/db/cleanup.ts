/**
 * Database cleanup utilities for retention policies
 */

import { getConfig } from '../lib/config'
import { createLogger } from '../lib/logger'
import { queries } from './index'

const log = createLogger('db:cleanup')

// Cleanup interval in milliseconds (24 hours)
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

let cleanupTimer: ReturnType<typeof setInterval> | null = null

/**
 * Delete events older than the retention period
 * @returns Number of events deleted
 */
export function cleanupOldEvents(): number {
  const config = getConfig()
  const retentionDays = config.eventsRetentionDays

  // Calculate cutoff timestamp (now - retentionDays in milliseconds)
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000

  try {
    const result = queries.deleteOldEvents.run(cutoffMs)
    const deletedCount = result.changes

    if (deletedCount > 0) {
      log.info('Cleaned up old events', {
        deletedCount,
        retentionDays,
        cutoffDate: new Date(cutoffMs).toISOString(),
      })
    } else {
      log.debug('No old events to clean up', {
        retentionDays,
        cutoffDate: new Date(cutoffMs).toISOString(),
      })
    }

    return deletedCount
  } catch (error) {
    log.error('Failed to clean up old events', {
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}

/**
 * Start the scheduled event cleanup
 * Runs immediately on startup, then daily thereafter
 */
export function startEventCleanup(): void {
  const config = getConfig()

  log.info('Starting event cleanup scheduler', {
    retentionDays: config.eventsRetentionDays,
    intervalHours: CLEANUP_INTERVAL_MS / (60 * 60 * 1000),
  })

  // Run immediately on startup to catch up if missed
  cleanupOldEvents()

  // Schedule daily cleanup
  cleanupTimer = setInterval(() => {
    cleanupOldEvents()
  }, CLEANUP_INTERVAL_MS)
}

/**
 * Stop the scheduled event cleanup
 */
export function stopEventCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
    log.info('Stopped event cleanup scheduler')
  }
}
