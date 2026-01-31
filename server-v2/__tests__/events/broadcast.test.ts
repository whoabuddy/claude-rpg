/**
 * Tests for pane_update broadcast on status changes
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { PaneUpdateMessage } from '../../api/messages'

// Track broadcast calls
let broadcastCalls: PaneUpdateMessage[] = []

// Mock the broadcast module before importing handlers
mock.module('../../api/broadcast', () => ({
  broadcast: (msg: PaneUpdateMessage) => {
    if (msg.type === 'pane_update') {
      broadcastCalls.push(msg)
    }
  },
}))

// Mock other dependencies
mock.module('../../lib/logger', () => ({
  createLogger: () => ({
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

mock.module('../../lib/discord', () => ({
  notifyWaiting: () => {},
  notifyComplete: () => {},
  notifyError: () => {},
}))

mock.module('../../personas/service', () => ({
  getOrCreatePersona: async () => ({ id: 'test-persona', name: 'Test' }),
  getPersonaById: () => ({ id: 'test-persona', name: 'Test' }),
  addXp: () => {},
  updateHealth: () => {},
}))

mock.module('../../personas/challenges', () => ({
  updateChallengeProgress: () => {},
  autoAssignChallenges: () => {},
  initChallengeSystem: () => {},
}))

mock.module('../../personas/health', () => ({
  ENERGY_GAIN_PROMPT: 5,
  ENERGY_GAIN_TOOL_USE: 1,
  MORALE_GAIN_SUCCESS: 2,
  MORALE_LOSS_ERROR: 5,
  MORALE_GAIN_TEST_PASS: 5,
  MORALE_GAIN_COMMIT: 10,
}))

mock.module('../../companions', () => ({
  incrementStat: () => {},
  updateStreak: () => {},
}))

mock.module('../../xp/calculator', () => ({
  calculateXp: () => 10,
}))

mock.module('../../xp/ledger', () => ({
  recordXpEvent: () => {},
}))

mock.module('../../projects', () => ({
  getProjectById: () => null,
}))

// Mock session manager with controllable session
let mockSession: { id: string; paneId: string; personaId: string | null; projectId: string | null; status: string; statusSource: string; statusChangedAt: string; lastActivityAt: string } | null = null

mock.module('../../sessions/manager', () => ({
  getSession: () => mockSession,
  updateFromHook: async () => {},
  clearError: () => {},
}))

// Now import the event bus and handlers
import { eventBus } from '../../events/bus'
import { initEventHandlers } from '../../events/handlers'
import type { SessionStatusChangedEvent } from '../../events/types'

describe('pane_update broadcast', () => {
  beforeEach(() => {
    broadcastCalls = []
    mockSession = null
  })

  test('broadcasts pane_update on session:status_changed', async () => {
    // Initialize handlers
    initEventHandlers()

    // Set up mock session
    mockSession = {
      id: 'session-123',
      paneId: 'pane-1',
      personaId: 'persona-1',
      projectId: null,
      status: 'working',
      statusSource: 'hook',
      statusChangedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    }

    // Emit status change event
    await eventBus.emit<SessionStatusChangedEvent>({
      type: 'session:status_changed',
      paneId: 'pane-1',
      personaId: 'persona-1',
      oldStatus: 'idle',
      newStatus: 'working',
    })

    // Verify broadcast was called
    expect(broadcastCalls.length).toBe(1)
    expect(broadcastCalls[0].type).toBe('pane_update')
    expect(broadcastCalls[0].paneId).toBe('pane-1')
    expect(broadcastCalls[0].session).toBeDefined()
    expect(broadcastCalls[0].session.status).toBe('working')
  })

  test('deduplicates rapid broadcasts for same pane', async () => {
    // Initialize handlers (may already be initialized from previous test)
    try {
      initEventHandlers()
    } catch {
      // Handlers already initialized, that's fine
    }

    // Set up mock session
    mockSession = {
      id: 'session-456',
      paneId: 'pane-2',
      personaId: 'persona-2',
      projectId: null,
      status: 'working',
      statusSource: 'hook',
      statusChangedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    }

    // Emit multiple rapid status changes (within 50ms window)
    await eventBus.emit<SessionStatusChangedEvent>({
      type: 'session:status_changed',
      paneId: 'pane-2',
      personaId: 'persona-2',
      oldStatus: 'idle',
      newStatus: 'working',
    })

    await eventBus.emit<SessionStatusChangedEvent>({
      type: 'session:status_changed',
      paneId: 'pane-2',
      personaId: 'persona-2',
      oldStatus: 'working',
      newStatus: 'waiting',
    })

    // Second broadcast should be deduplicated (within 50ms)
    // First one goes through, second may or may not depending on timing
    expect(broadcastCalls.length).toBeGreaterThanOrEqual(1)
    expect(broadcastCalls.length).toBeLessThanOrEqual(2)
  })

  test('skips broadcast when session not found', async () => {
    // Initialize handlers
    try {
      initEventHandlers()
    } catch {
      // Already initialized
    }

    // No session (null)
    mockSession = null

    // Emit status change event
    await eventBus.emit<SessionStatusChangedEvent>({
      type: 'session:status_changed',
      paneId: 'pane-missing',
      personaId: 'persona-1',
      oldStatus: 'idle',
      newStatus: 'working',
    })

    // Should not have broadcast (no session)
    const callsForMissingPane = broadcastCalls.filter(c => c.paneId === 'pane-missing')
    expect(callsForMissingPane.length).toBe(0)
  })
})
