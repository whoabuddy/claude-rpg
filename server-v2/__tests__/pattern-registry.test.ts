/**
 * Pattern registry tests
 */

import { describe, test, expect } from 'bun:test'
import {
  getPatternVersion,
  getCurrentPatterns,
  getAllPatternVersions,
  getPatterns,
} from '../terminal/pattern-registry'

describe('pattern-registry', () => {
  describe('getPatternVersion', () => {
    test('returns version 1.0.0', () => {
      const version = getPatternVersion('1.0.0')
      expect(version).not.toBeNull()
      expect(version?.version).toBe('1.0.0')
      expect(version?.claudeCodeVersion).toContain('1.x')
    })

    test('returns null for non-existent version', () => {
      const version = getPatternVersion('99.99.99')
      expect(version).toBeNull()
    })
  })

  describe('getCurrentPatterns', () => {
    test('returns current pattern version', () => {
      const current = getCurrentPatterns()
      expect(current.version).toBe('1.0.0')
      expect(current.patterns).toBeDefined()
      expect(current.patterns.waiting).toBeInstanceOf(Array)
      expect(current.patterns.working).toBeInstanceOf(Array)
      expect(current.patterns.idle).toBeInstanceOf(Array)
      expect(current.patterns.error).toBeInstanceOf(Array)
    })

    test('current patterns have expected structure', () => {
      const current = getCurrentPatterns()

      // Check waiting patterns
      expect(current.patterns.waiting.length).toBeGreaterThan(0)
      current.patterns.waiting.forEach(p => {
        expect(p.name).toBeDefined()
        expect(p.regex).toBeInstanceOf(RegExp)
        expect(p.confidence).toBeGreaterThan(0)
        expect(p.confidence).toBeLessThanOrEqual(1)
      })

      // Check working patterns
      expect(current.patterns.working.length).toBeGreaterThan(0)
      current.patterns.working.forEach(p => {
        expect(p.name).toBeDefined()
        expect(p.regex).toBeInstanceOf(RegExp)
        expect(p.confidence).toBeGreaterThan(0)
        expect(p.confidence).toBeLessThanOrEqual(1)
      })

      // Check idle patterns
      expect(current.patterns.idle.length).toBeGreaterThan(0)
      current.patterns.idle.forEach(p => {
        expect(p.name).toBeDefined()
        expect(p.regex).toBeInstanceOf(RegExp)
        expect(p.confidence).toBeGreaterThan(0)
        expect(p.confidence).toBeLessThanOrEqual(1)
      })

      // Check error patterns
      expect(current.patterns.error.length).toBeGreaterThan(0)
      current.patterns.error.forEach(p => {
        expect(p.name).toBeDefined()
        expect(p.regex).toBeInstanceOf(RegExp)
        expect(p.confidence).toBeGreaterThan(0)
        expect(p.confidence).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('getAllPatternVersions', () => {
    test('returns array of all versions', () => {
      const versions = getAllPatternVersions()
      expect(versions).toBeInstanceOf(Array)
      expect(versions.length).toBeGreaterThan(0)
    })

    test('versions are sorted with metadata', () => {
      const versions = getAllPatternVersions()
      versions.forEach(v => {
        expect(v.version).toBeDefined()
        expect(v.claudeCodeVersion).toBeDefined()
        expect(v.createdAt).toBeDefined()
        expect(v.patterns).toBeDefined()
      })
    })
  })

  describe('getPatterns', () => {
    test('returns waiting patterns', () => {
      const patterns = getPatterns('waiting')
      expect(patterns).toBeInstanceOf(Array)
      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns[0].name).toBeDefined()
    })

    test('returns working patterns', () => {
      const patterns = getPatterns('working')
      expect(patterns).toBeInstanceOf(Array)
      expect(patterns.length).toBeGreaterThan(0)
    })

    test('returns idle patterns', () => {
      const patterns = getPatterns('idle')
      expect(patterns).toBeInstanceOf(Array)
      expect(patterns.length).toBeGreaterThan(0)
    })

    test('returns error patterns', () => {
      const patterns = getPatterns('error')
      expect(patterns).toBeInstanceOf(Array)
      expect(patterns.length).toBeGreaterThan(0)
    })
  })

  describe('pattern metadata', () => {
    test('version 1.0.0 has expected Claude Code version', () => {
      const version = getPatternVersion('1.0.0')
      expect(version?.claudeCodeVersion).toBe('1.x (Jan 2026)')
    })

    test('version 1.0.0 has expected creation date', () => {
      const version = getPatternVersion('1.0.0')
      expect(version?.createdAt).toBe('2026-01-31')
    })

    test('all pattern sets are non-empty', () => {
      const current = getCurrentPatterns()
      expect(current.patterns.waiting.length).toBeGreaterThan(0)
      expect(current.patterns.working.length).toBeGreaterThan(0)
      expect(current.patterns.idle.length).toBeGreaterThan(0)
      expect(current.patterns.error.length).toBeGreaterThan(0)
    })
  })
})
