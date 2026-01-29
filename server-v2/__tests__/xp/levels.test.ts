/**
 * Level calculation tests
 */

import { describe, test, expect } from 'bun:test'
import {
  xpForLevel,
  totalXpForLevel,
  levelFromTotalXp,
  getTitleForLevel,
  xpToNextLevel,
} from '../../xp/levels'

describe('xpForLevel', () => {
  test('returns 0 for level 1', () => {
    expect(xpForLevel(1)).toBe(0)
  })

  test('returns 100 for level 2', () => {
    expect(xpForLevel(2)).toBe(100)
  })

  test('returns 150 for level 3 (100 * 1.5)', () => {
    expect(xpForLevel(3)).toBe(150)
  })

  test('returns 225 for level 4 (100 * 1.5^2)', () => {
    expect(xpForLevel(4)).toBe(225)
  })

  test('increases exponentially', () => {
    expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(4))
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(5))
  })
})

describe('totalXpForLevel', () => {
  test('returns 0 for level 1', () => {
    expect(totalXpForLevel(1)).toBe(0)
  })

  test('returns 100 for level 2', () => {
    expect(totalXpForLevel(2)).toBe(100)
  })

  test('returns 250 for level 3', () => {
    expect(totalXpForLevel(3)).toBe(250) // 100 + 150
  })
})

describe('levelFromTotalXp', () => {
  test('returns level 1 for 0 XP', () => {
    const result = levelFromTotalXp(0)
    expect(result.level).toBe(1)
    expect(result.xpIntoLevel).toBe(0)
    expect(result.xpForNextLevel).toBe(100)
    expect(result.progressPercent).toBe(0)
  })

  test('returns level 1 at 50 XP (50% progress)', () => {
    const result = levelFromTotalXp(50)
    expect(result.level).toBe(1)
    expect(result.xpIntoLevel).toBe(50)
    expect(result.progressPercent).toBe(50)
  })

  test('returns level 2 at 100 XP', () => {
    const result = levelFromTotalXp(100)
    expect(result.level).toBe(2)
    expect(result.xpIntoLevel).toBe(0)
  })

  test('returns level 3 at 250 XP', () => {
    const result = levelFromTotalXp(250)
    expect(result.level).toBe(3)
  })

  test('handles large XP values', () => {
    const result = levelFromTotalXp(10000)
    expect(result.level).toBeGreaterThan(5)
  })
})

describe('getTitleForLevel', () => {
  test('returns Apprentice for levels 1-4', () => {
    expect(getTitleForLevel(1)).toBe('Apprentice')
    expect(getTitleForLevel(4)).toBe('Apprentice')
  })

  test('returns Journeyman for levels 5-9', () => {
    expect(getTitleForLevel(5)).toBe('Journeyman')
    expect(getTitleForLevel(9)).toBe('Journeyman')
  })

  test('returns Expert for levels 10-14', () => {
    expect(getTitleForLevel(10)).toBe('Expert')
    expect(getTitleForLevel(14)).toBe('Expert')
  })

  test('returns Master for levels 15-19', () => {
    expect(getTitleForLevel(15)).toBe('Master')
    expect(getTitleForLevel(19)).toBe('Master')
  })

  test('returns Grandmaster for levels 20-29', () => {
    expect(getTitleForLevel(20)).toBe('Grandmaster')
    expect(getTitleForLevel(29)).toBe('Grandmaster')
  })

  test('returns Legend for level 30+', () => {
    expect(getTitleForLevel(30)).toBe('Legend')
    expect(getTitleForLevel(100)).toBe('Legend')
  })
})

describe('xpToNextLevel', () => {
  test('returns correct XP needed from 0', () => {
    expect(xpToNextLevel(0)).toBe(100)
  })

  test('returns correct XP needed at 50', () => {
    expect(xpToNextLevel(50)).toBe(50)
  })

  test('returns correct XP needed at level boundary', () => {
    expect(xpToNextLevel(100)).toBe(150)
  })
})
