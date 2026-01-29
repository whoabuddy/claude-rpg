/**
 * Test helper functions
 */

import type { Persona } from '../personas/types'
import type { Project } from '../projects/types'
import type { Quest, QuestPhase } from '../quests/types'

/**
 * Create a test persona
 */
export function createTestPersona(overrides: Partial<Persona> = {}): Persona {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    sessionId: `session-${Math.random().toString(36).slice(2)}`,
    name: 'Test Persona',
    avatarUrl: null,
    status: 'active',
    totalXp: 0,
    level: 1,
    createdAt: now,
    lastSeenAt: now,
    ...overrides,
  }
}

/**
 * Create a test project
 */
export function createTestProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    path: '/tmp/test-project',
    name: 'test-project',
    githubUrl: null,
    projectClass: 'unknown',
    totalXp: 0,
    level: 1,
    createdAt: now,
    lastActivityAt: now,
    ...overrides,
  }
}

/**
 * Create a test quest
 */
export function createTestQuest(overrides: Partial<Quest> = {}): Quest {
  const now = new Date().toISOString()
  const phases: QuestPhase[] = [
    { id: 'phase-1', name: 'Phase 1', status: 'pending', retryCount: 0 },
    { id: 'phase-2', name: 'Phase 2', status: 'pending', retryCount: 0 },
  ]

  return {
    id: crypto.randomUUID(),
    projectId: null,
    title: 'Test Quest',
    description: 'A test quest',
    status: 'planned',
    phases,
    xpAwarded: 0,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

/**
 * Wait for milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
