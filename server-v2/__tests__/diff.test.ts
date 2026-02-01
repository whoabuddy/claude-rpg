/**
 * Tests for line-based diff algorithm
 */

import { describe, test, expect } from 'bun:test'
import { generateDiff, applyDiff } from '../lib/diff'

describe('diff algorithm', () => {
  describe('generateDiff', () => {
    test('empty to empty', () => {
      const result = generateDiff('', '')
      expect(result.ops).toEqual([])
      expect(result.estimatedSize).toBe(0)
    })

    test('empty to content', () => {
      const result = generateDiff('', 'line1\nline2\nline3')
      expect(result.ops).toEqual([
        { type: 'add', lines: ['line1', 'line2', 'line3'] },
      ])
      expect(result.estimatedSize).toBeGreaterThan(0)
    })

    test('content to empty', () => {
      const result = generateDiff('line1\nline2\nline3', '')
      expect(result.ops).toEqual([
        { type: 'remove', count: 3 },
      ])
      expect(result.estimatedSize).toBeGreaterThan(0)
    })

    test('no changes', () => {
      const content = 'line1\nline2\nline3'
      const result = generateDiff(content, content)
      expect(result.ops).toEqual([
        { type: 'keep', count: 3 },
      ])
    })

    test('append lines (common terminal case)', () => {
      const old = 'line1\nline2\nline3'
      const new_ = 'line1\nline2\nline3\nline4\nline5'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'keep', count: 3 },
        { type: 'add', lines: ['line4', 'line5'] },
      ])
    })

    test('prepend lines', () => {
      const old = 'line3\nline4\nline5'
      const new_ = 'line1\nline2\nline3\nline4\nline5'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'add', lines: ['line1', 'line2'] },
        { type: 'keep', count: 3 },
      ])
    })

    test('remove lines from end', () => {
      const old = 'line1\nline2\nline3\nline4\nline5'
      const new_ = 'line1\nline2\nline3'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'keep', count: 3 },
        { type: 'remove', count: 2 },
      ])
    })

    test('remove lines from start', () => {
      const old = 'line1\nline2\nline3\nline4\nline5'
      const new_ = 'line3\nline4\nline5'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'remove', count: 2 },
        { type: 'keep', count: 3 },
      ])
    })

    test('change middle lines', () => {
      const old = 'line1\nline2\nline3\nline4\nline5'
      const new_ = 'line1\nline2\nchanged\nline4\nline5'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'keep', count: 2 },
        { type: 'remove', count: 1 },
        { type: 'add', lines: ['changed'] },
        { type: 'keep', count: 2 },
      ])
    })

    test('complete rewrite', () => {
      const old = 'old1\nold2\nold3'
      const new_ = 'new1\nnew2\nnew3'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'remove', count: 3 },
        { type: 'add', lines: ['new1', 'new2', 'new3'] },
      ])
    })

    test('spinner update (last line changes)', () => {
      const old = 'Output line 1\nOutput line 2\n⠋ Working...'
      const new_ = 'Output line 1\nOutput line 2\n⠙ Working...'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'keep', count: 2 },
        { type: 'remove', count: 1 },
        { type: 'add', lines: ['⠙ Working...'] },
      ])
    })

    test('terminal scrollback (prefix grows, suffix same)', () => {
      const old = 'line1\nline2\nline3\n> prompt'
      const new_ = 'line1\nline2\nline3\nline4\nline5\n> prompt'
      const result = generateDiff(old, new_)
      expect(result.ops).toEqual([
        { type: 'keep', count: 3 },
        { type: 'add', lines: ['line4', 'line5'] },
        { type: 'keep', count: 1 },
      ])
    })
  })

  describe('applyDiff', () => {
    test('apply empty diff', () => {
      const result = applyDiff('line1\nline2', [])
      expect(result).toBe('line1\nline2')
    })

    test('apply keep-only', () => {
      const result = applyDiff('line1\nline2\nline3', [
        { type: 'keep', count: 3 },
      ])
      expect(result).toBe('line1\nline2\nline3')
    })

    test('apply add to empty', () => {
      const result = applyDiff('', [
        { type: 'add', lines: ['line1', 'line2'] },
      ])
      expect(result).toBe('line1\nline2')
    })

    test('apply remove all', () => {
      const result = applyDiff('line1\nline2\nline3', [
        { type: 'remove', count: 3 },
      ])
      expect(result).toBe('')
    })

    test('apply append', () => {
      const result = applyDiff('line1\nline2', [
        { type: 'keep', count: 2 },
        { type: 'add', lines: ['line3', 'line4'] },
      ])
      expect(result).toBe('line1\nline2\nline3\nline4')
    })

    test('apply mixed operations', () => {
      const result = applyDiff('line1\nline2\nline3\nline4\nline5', [
        { type: 'keep', count: 2 },
        { type: 'remove', count: 1 },
        { type: 'add', lines: ['new3'] },
        { type: 'keep', count: 2 },
      ])
      expect(result).toBe('line1\nline2\nnew3\nline4\nline5')
    })
  })

  describe('round-trip consistency', () => {
    test('generateDiff + applyDiff = identity', () => {
      const testCases = [
        { old: '', new_: 'line1\nline2' },
        { old: 'line1\nline2', new_: '' },
        { old: 'line1\nline2', new_: 'line1\nline2' },
        { old: 'line1\nline2', new_: 'line1\nline2\nline3' },
        { old: 'line1\nline2\nline3', new_: 'line1\nline3' },
        { old: 'old\nold\nold', new_: 'new\nnew\nnew' },
      ]

      for (const { old, new_ } of testCases) {
        const diff = generateDiff(old, new_)
        const result = applyDiff(old, diff.ops)
        expect(result).toBe(new_)
      }
    })

    test('typical terminal append scenario', () => {
      let content = 'Starting server...'

      // Simulate progressive output
      const updates = [
        'Starting server...\nInitializing database...',
        'Starting server...\nInitializing database...\nLoading modules...',
        'Starting server...\nInitializing database...\nLoading modules...\nServer ready on port 4011',
      ]

      for (const newContent of updates) {
        const diff = generateDiff(content, newContent)
        const reconstructed = applyDiff(content, diff.ops)
        expect(reconstructed).toBe(newContent)
        content = newContent
      }
    })
  })

  describe('size estimation', () => {
    test('estimated size is reasonable', () => {
      const old = 'line1\nline2\nline3'
      const new_ = 'line1\nline2\nline3\nline4\nline5'
      const diff = generateDiff(old, new_)

      // Actual JSON size
      const actualSize = JSON.stringify(diff.ops).length

      // Estimate should be within 20% of actual
      const ratio = diff.estimatedSize / actualSize
      expect(ratio).toBeGreaterThan(0.8)
      expect(ratio).toBeLessThan(1.2)
    })

    test('large content has reasonable estimate', () => {
      const oldLines = Array.from({ length: 100 }, (_, i) => `Line ${i}: Some content here`)
      const newLines = [
        ...oldLines,
        ...Array.from({ length: 10 }, (_, i) => `New line ${i}: Additional content`),
      ]

      const old = oldLines.join('\n')
      const new_ = newLines.join('\n')
      const diff = generateDiff(old, new_)

      const actualSize = JSON.stringify(diff.ops).length
      const ratio = diff.estimatedSize / actualSize

      expect(ratio).toBeGreaterThan(0.8)
      expect(ratio).toBeLessThan(1.2)
    })
  })

  describe('edge cases', () => {
    test('single line', () => {
      const diff = generateDiff('line1', 'line2')
      const result = applyDiff('line1', diff.ops)
      expect(result).toBe('line2')
    })

    test('trailing newline handling', () => {
      const diff = generateDiff('line1\n', 'line1\nline2\n')
      const result = applyDiff('line1\n', diff.ops)
      expect(result).toBe('line1\nline2\n')
    })

    test('empty lines in content', () => {
      const old = 'line1\n\nline3'
      const new_ = 'line1\n\nline3\n\nline5'
      const diff = generateDiff(old, new_)
      const result = applyDiff(old, diff.ops)
      expect(result).toBe(new_)
    })

    test('very long lines', () => {
      const longLine = 'x'.repeat(1000)
      const old = `line1\n${longLine}\nline3`
      const new_ = `line1\n${longLine}\nline3\nline4`
      const diff = generateDiff(old, new_)
      const result = applyDiff(old, diff.ops)
      expect(result).toBe(new_)
    })
  })
})
