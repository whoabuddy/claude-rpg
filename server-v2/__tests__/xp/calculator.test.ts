/**
 * XP Calculator tests
 */

import { describe, test, expect } from 'bun:test'
import { calculateXp, getXpCategory, XP_VALUES } from '../../xp/calculator'

describe('calculateXp', () => {
  test('returns correct XP for tool events', () => {
    expect(calculateXp('tool:Read')).toBe(1)
    expect(calculateXp('tool:Edit')).toBe(3)
    expect(calculateXp('tool:Write')).toBe(5)
    expect(calculateXp('tool:Bash')).toBe(2)
    expect(calculateXp('tool:Task')).toBe(5)
    expect(calculateXp('tool:Grep')).toBe(1)
    expect(calculateXp('tool:Glob')).toBe(1)
  })

  test('returns correct XP for git events', () => {
    expect(calculateXp('git:commit')).toBe(15)
    expect(calculateXp('git:push')).toBe(10)
    expect(calculateXp('git:branch')).toBe(5)
    expect(calculateXp('git:pr_created')).toBe(20)
    expect(calculateXp('git:pr_merged')).toBe(50)
  })

  test('returns correct XP for quest events', () => {
    expect(calculateXp('quest:created')).toBe(5)
    expect(calculateXp('quest:phase_planned')).toBe(10)
    expect(calculateXp('quest:phase_completed')).toBe(25)
    expect(calculateXp('quest:completed')).toBe(100)
  })

  test('returns correct XP for achievement events', () => {
    expect(calculateXp('achievement:unlocked')).toBe(25)
    expect(calculateXp('achievement:rare')).toBe(50)
    expect(calculateXp('achievement:legendary')).toBe(100)
  })

  test('returns default XP for unknown tool types', () => {
    expect(calculateXp('tool:UnknownTool')).toBe(2)
  })

  test('returns default XP for unknown git types', () => {
    expect(calculateXp('git:unknown')).toBe(5)
  })

  test('returns 1 XP for completely unknown events', () => {
    expect(calculateXp('unknown:event')).toBe(1)
    expect(calculateXp('random')).toBe(1)
  })
})

describe('getXpCategory', () => {
  test('categorizes tool events', () => {
    expect(getXpCategory('tool:Read')).toBe('tool_use')
    expect(getXpCategory('tool:Edit')).toBe('tool_use')
  })

  test('categorizes git events', () => {
    expect(getXpCategory('git:commit')).toBe('git')
    expect(getXpCategory('git:push')).toBe('git')
  })

  test('categorizes quest events', () => {
    expect(getXpCategory('quest:completed')).toBe('quest')
  })

  test('categorizes achievement events', () => {
    expect(getXpCategory('achievement:unlocked')).toBe('achievement')
  })

  test('categorizes bonus events', () => {
    expect(getXpCategory('bonus:streak')).toBe('bonus')
  })

  test('returns other for unknown categories', () => {
    expect(getXpCategory('unknown:event')).toBe('other')
  })
})
