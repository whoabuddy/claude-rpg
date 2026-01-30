/**
 * Moltbook API handlers
 *
 * HTTP handlers for moltbook routes
 */

import { createLogger } from '../lib/logger'
import {
  readActivityEvents,
  readHealthState,
  readOrchestratorState,
  readRelationships,
  getCurrentDate,
} from './reader'
import type { ApiResponse } from '../api/types'
import type {
  MoltbookActivityResponse,
  MoltbookHealthResponse,
  MoltbookRelationshipsResponse,
  MoltbookStateResponse,
} from './types'

const log = createLogger('moltbook-api')

/**
 * GET /api/moltbook/activity
 *
 * Returns recent activity events from the feed
 * Query params:
 *   - limit: number of events (default 50, max 200)
 *   - date: specific date YYYY-MM-DD (default: today)
 */
export function getMoltbookActivity(
  query: URLSearchParams
): ApiResponse<MoltbookActivityResponse> {
  const limitParam = query.get('limit')
  const date = query.get('date') || undefined

  // Parse and clamp limit
  let limit = 50
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 200)
    }
  }

  try {
    const events = readActivityEvents(limit, date)
    const currentDate = date || getCurrentDate()

    log.debug('Fetched activity events', { count: events.length, date: currentDate })

    return {
      success: true,
      data: {
        events,
        total: events.length,
        date: currentDate,
      },
    }
  } catch (error) {
    log.error('Failed to fetch activity', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: 'Failed to read activity events',
      },
    }
  }
}

/**
 * GET /api/moltbook/health
 *
 * Returns current health state
 */
export function getMoltbookHealth(): ApiResponse<MoltbookHealthResponse> {
  try {
    const health = readHealthState()

    if (!health) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Health state not available',
        },
      }
    }

    log.debug('Fetched health state', { status: health.status })

    return {
      success: true,
      data: { health },
    }
  } catch (error) {
    log.error('Failed to fetch health', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: 'Failed to read health state',
      },
    }
  }
}

/**
 * GET /api/moltbook/relationships
 *
 * Returns agent relationships data
 */
export function getMoltbookRelationships(): ApiResponse<MoltbookRelationshipsResponse> {
  try {
    const relationships = readRelationships()

    if (!relationships) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Relationships data not available',
        },
      }
    }

    log.debug('Fetched relationships', { agentCount: relationships.agents.length })

    return {
      success: true,
      data: { relationships },
    }
  } catch (error) {
    log.error('Failed to fetch relationships', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: 'Failed to read relationships data',
      },
    }
  }
}

/**
 * GET /api/moltbook/state
 *
 * Returns orchestrator state
 */
export function getMoltbookState(): ApiResponse<MoltbookStateResponse> {
  try {
    const state = readOrchestratorState()

    if (!state) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Orchestrator state not available',
        },
      }
    }

    log.debug('Fetched orchestrator state', { totalRuns: state.total_runs })

    return {
      success: true,
      data: { state },
    }
  } catch (error) {
    log.error('Failed to fetch state', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: 'Failed to read orchestrator state',
      },
    }
  }
}
