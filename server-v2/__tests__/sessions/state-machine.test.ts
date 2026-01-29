/**
 * Session state machine tests - 100% coverage target
 */

import { describe, test, expect } from 'bun:test'
import {
  VALID_SESSION_TRANSITIONS,
  transitionSession,
  isValidSessionTransition,
  getStatusPriority,
} from '../../sessions/state-machine'
import type { SessionStatus } from '../../sessions/types'

describe('Session State Machine', () => {
  describe('transitionSession', () => {
    // Same state transitions (always valid)
    test('allows same state transition (no-op)', () => {
      expect(transitionSession('idle', 'idle')).toBe('idle')
      expect(transitionSession('working', 'working')).toBe('working')
      expect(transitionSession('waiting', 'waiting')).toBe('waiting')
      expect(transitionSession('error', 'error')).toBe('error')
      expect(transitionSession('typing', 'typing')).toBe('typing')
    })

    // From idle
    test('allows idle -> typing', () => {
      expect(transitionSession('idle', 'typing')).toBe('typing')
    })

    test('allows idle -> working', () => {
      expect(transitionSession('idle', 'working')).toBe('working')
    })

    test('allows idle -> waiting', () => {
      expect(transitionSession('idle', 'waiting')).toBe('waiting')
    })

    test('allows idle -> error', () => {
      expect(transitionSession('idle', 'error')).toBe('error')
    })

    // From typing
    test('allows typing -> idle', () => {
      expect(transitionSession('typing', 'idle')).toBe('idle')
    })

    test('allows typing -> working', () => {
      expect(transitionSession('typing', 'working')).toBe('working')
    })

    test('allows typing -> waiting', () => {
      expect(transitionSession('typing', 'waiting')).toBe('waiting')
    })

    test('allows typing -> error', () => {
      expect(transitionSession('typing', 'error')).toBe('error')
    })

    // From working
    test('allows working -> idle', () => {
      expect(transitionSession('working', 'idle')).toBe('idle')
    })

    test('allows working -> waiting', () => {
      expect(transitionSession('working', 'waiting')).toBe('waiting')
    })

    test('allows working -> error', () => {
      expect(transitionSession('working', 'error')).toBe('error')
    })

    test('throws on working -> typing', () => {
      expect(() => transitionSession('working', 'typing')).toThrow()
    })

    // From waiting
    test('allows waiting -> idle', () => {
      expect(transitionSession('waiting', 'idle')).toBe('idle')
    })

    test('allows waiting -> typing', () => {
      expect(transitionSession('waiting', 'typing')).toBe('typing')
    })

    test('allows waiting -> working', () => {
      expect(transitionSession('waiting', 'working')).toBe('working')
    })

    test('allows waiting -> error', () => {
      expect(transitionSession('waiting', 'error')).toBe('error')
    })

    // From error
    test('allows error -> idle', () => {
      expect(transitionSession('error', 'idle')).toBe('idle')
    })

    test('allows error -> working', () => {
      expect(transitionSession('error', 'working')).toBe('working')
    })

    test('allows error -> waiting', () => {
      expect(transitionSession('error', 'waiting')).toBe('waiting')
    })

    test('throws on error -> typing', () => {
      expect(() => transitionSession('error', 'typing')).toThrow()
    })
  })

  describe('isValidSessionTransition', () => {
    test('returns true for valid transitions', () => {
      expect(isValidSessionTransition('idle', 'working')).toBe(true)
      expect(isValidSessionTransition('working', 'idle')).toBe(true)
      expect(isValidSessionTransition('waiting', 'working')).toBe(true)
    })

    test('returns false for invalid transitions', () => {
      expect(isValidSessionTransition('working', 'typing')).toBe(false)
      expect(isValidSessionTransition('error', 'typing')).toBe(false)
    })

    test('returns true for same state', () => {
      expect(isValidSessionTransition('idle', 'idle')).toBe(true)
    })
  })

  describe('getStatusPriority', () => {
    test('error has highest priority', () => {
      expect(getStatusPriority('error')).toBe(5)
    })

    test('waiting has high priority', () => {
      expect(getStatusPriority('waiting')).toBe(4)
    })

    test('working has medium priority', () => {
      expect(getStatusPriority('working')).toBe(3)
    })

    test('typing has low priority', () => {
      expect(getStatusPriority('typing')).toBe(2)
    })

    test('idle has lowest priority', () => {
      expect(getStatusPriority('idle')).toBe(1)
    })

    test('priorities are in correct order', () => {
      expect(getStatusPriority('error')).toBeGreaterThan(getStatusPriority('waiting'))
      expect(getStatusPriority('waiting')).toBeGreaterThan(getStatusPriority('working'))
      expect(getStatusPriority('working')).toBeGreaterThan(getStatusPriority('typing'))
      expect(getStatusPriority('typing')).toBeGreaterThan(getStatusPriority('idle'))
    })
  })
})
