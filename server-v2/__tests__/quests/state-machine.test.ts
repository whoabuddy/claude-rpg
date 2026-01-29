/**
 * Quest state machine tests - 100% coverage target
 */

import { describe, test, expect } from 'bun:test'
import {
  VALID_QUEST_TRANSITIONS,
  VALID_PHASE_TRANSITIONS,
  transitionQuest,
  transitionPhase,
  isValidQuestTransition,
  isValidPhaseTransition,
  isQuestTerminal,
  isPhaseTerminal,
} from '../../quests/state-machine'
import type { QuestStatus, QuestPhaseStatus } from '../../quests/types'

describe('Quest State Machine', () => {
  describe('transitionQuest', () => {
    test('allows planned -> active', () => {
      expect(transitionQuest('planned', 'active')).toBe('active')
    })

    test('allows planned -> archived', () => {
      expect(transitionQuest('planned', 'archived')).toBe('archived')
    })

    test('allows active -> paused', () => {
      expect(transitionQuest('active', 'paused')).toBe('paused')
    })

    test('allows active -> completed', () => {
      expect(transitionQuest('active', 'completed')).toBe('completed')
    })

    test('allows active -> failed', () => {
      expect(transitionQuest('active', 'failed')).toBe('failed')
    })

    test('allows paused -> active', () => {
      expect(transitionQuest('paused', 'active')).toBe('active')
    })

    test('allows paused -> archived', () => {
      expect(transitionQuest('paused', 'archived')).toBe('archived')
    })

    test('allows completed -> archived', () => {
      expect(transitionQuest('completed', 'archived')).toBe('archived')
    })

    test('allows failed -> archived', () => {
      expect(transitionQuest('failed', 'archived')).toBe('archived')
    })

    test('allows failed -> active (retry)', () => {
      expect(transitionQuest('failed', 'active')).toBe('active')
    })

    test('throws on planned -> completed (skip active)', () => {
      expect(() => transitionQuest('planned', 'completed')).toThrow()
    })

    test('throws on archived -> anything', () => {
      expect(() => transitionQuest('archived', 'active')).toThrow()
      expect(() => transitionQuest('archived', 'planned')).toThrow()
    })

    test('throws on completed -> active (reverse)', () => {
      expect(() => transitionQuest('completed', 'active')).toThrow()
    })
  })

  describe('isValidQuestTransition', () => {
    test('returns true for valid transitions', () => {
      expect(isValidQuestTransition('planned', 'active')).toBe(true)
      expect(isValidQuestTransition('active', 'completed')).toBe(true)
    })

    test('returns false for invalid transitions', () => {
      expect(isValidQuestTransition('planned', 'completed')).toBe(false)
      expect(isValidQuestTransition('archived', 'active')).toBe(false)
    })

    test('returns true for same state (no-op)', () => {
      expect(isValidQuestTransition('active', 'active')).toBe(true)
      expect(isValidQuestTransition('completed', 'completed')).toBe(true)
    })
  })

  describe('isQuestTerminal', () => {
    test('returns true for archived', () => {
      expect(isQuestTerminal('archived')).toBe(true)
    })

    test('returns false for non-terminal states', () => {
      expect(isQuestTerminal('planned')).toBe(false)
      expect(isQuestTerminal('active')).toBe(false)
      expect(isQuestTerminal('paused')).toBe(false)
      expect(isQuestTerminal('completed')).toBe(false)
      expect(isQuestTerminal('failed')).toBe(false)
    })
  })
})

describe('Phase State Machine', () => {
  describe('transitionPhase', () => {
    test('allows pending -> planned', () => {
      expect(transitionPhase('pending', 'planned')).toBe('planned')
    })

    test('allows pending -> skipped', () => {
      expect(transitionPhase('pending', 'skipped')).toBe('skipped')
    })

    test('allows planned -> executing', () => {
      expect(transitionPhase('planned', 'executing')).toBe('executing')
    })

    test('allows planned -> skipped', () => {
      expect(transitionPhase('planned', 'skipped')).toBe('skipped')
    })

    test('allows executing -> completed', () => {
      expect(transitionPhase('executing', 'completed')).toBe('completed')
    })

    test('allows executing -> failed', () => {
      expect(transitionPhase('executing', 'failed')).toBe('failed')
    })

    test('allows executing -> retrying', () => {
      expect(transitionPhase('executing', 'retrying')).toBe('retrying')
    })

    test('allows retrying -> executing', () => {
      expect(transitionPhase('retrying', 'executing')).toBe('executing')
    })

    test('allows retrying -> failed', () => {
      expect(transitionPhase('retrying', 'failed')).toBe('failed')
    })

    test('allows retrying -> skipped', () => {
      expect(transitionPhase('retrying', 'skipped')).toBe('skipped')
    })

    test('allows failed -> retrying', () => {
      expect(transitionPhase('failed', 'retrying')).toBe('retrying')
    })

    test('allows failed -> skipped', () => {
      expect(transitionPhase('failed', 'skipped')).toBe('skipped')
    })

    test('throws on completed -> anything', () => {
      expect(() => transitionPhase('completed', 'executing')).toThrow()
      expect(() => transitionPhase('completed', 'pending')).toThrow()
    })

    test('throws on skipped -> anything', () => {
      expect(() => transitionPhase('skipped', 'executing')).toThrow()
      expect(() => transitionPhase('skipped', 'pending')).toThrow()
    })

    test('throws on pending -> completed (skip steps)', () => {
      expect(() => transitionPhase('pending', 'completed')).toThrow()
    })
  })

  describe('isValidPhaseTransition', () => {
    test('returns true for valid transitions', () => {
      expect(isValidPhaseTransition('pending', 'planned')).toBe(true)
      expect(isValidPhaseTransition('executing', 'completed')).toBe(true)
    })

    test('returns false for invalid transitions', () => {
      expect(isValidPhaseTransition('pending', 'completed')).toBe(false)
      expect(isValidPhaseTransition('completed', 'executing')).toBe(false)
    })

    test('returns true for same state (no-op)', () => {
      expect(isValidPhaseTransition('executing', 'executing')).toBe(true)
    })
  })

  describe('isPhaseTerminal', () => {
    test('returns true for completed and skipped', () => {
      expect(isPhaseTerminal('completed')).toBe(true)
      expect(isPhaseTerminal('skipped')).toBe(true)
    })

    test('returns false for non-terminal states', () => {
      expect(isPhaseTerminal('pending')).toBe(false)
      expect(isPhaseTerminal('planned')).toBe(false)
      expect(isPhaseTerminal('executing')).toBe(false)
      expect(isPhaseTerminal('retrying')).toBe(false)
      expect(isPhaseTerminal('failed')).toBe(false)
    })
  })
})
