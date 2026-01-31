/**
 * Terminal parser tests
 */

import { describe, test, expect } from 'bun:test'
import { parseTerminal } from '../../terminal/parser'

describe('parseTerminal', () => {
  describe('empty/invalid content', () => {
    test('returns unknown for empty content', () => {
      const result = parseTerminal('')
      expect(result.status).toBe('unknown')
      expect(result.confidence).toBe(0)
    })

    test('returns unknown for whitespace only', () => {
      const result = parseTerminal('   \n\n   ')
      expect(result.status).toBe('unknown')
      expect(result.confidence).toBe(0)
    })
  })

  describe('waiting detection', () => {
    test('detects permission prompts', () => {
      const content = `
        Some output...
        Allow this command? (Bash)
        [y/n]:
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('waiting')
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    test('detects edit permission prompts', () => {
      const content = `
        File changes:
        - Added line 1
        - Added line 2
        Allow these changes? (Edit)
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('waiting')
    })

    test('detects plan mode', () => {
      const content = `
        === Plan Mode ===
        Approve this plan?
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('waiting')
    })
  })

  describe('working detection', () => {
    test('detects spinner characters', () => {
      const content = `
        ⠋ Working on something...
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('working')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('detects thinking indicator', () => {
      const content = `
        Thinking...
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('working')
    })

    test('detects tool execution', () => {
      const content = `
        Reading file /path/to/file.ts
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('working')
    })
  })

  describe('idle detection', () => {
    test('detects completion', () => {
      const content = `
        Task complete!
        ✓ All done
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('idle')
    })

    test('detects prompt', () => {
      const content = `
        Some output...
        Claude >
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('idle')
    })
  })

  describe('error detection', () => {
    test('generic error messages have lower confidence (false positive prevention)', () => {
      // Generic "Error:" messages have lowered confidence (0.6) to reduce false positives
      // from tool output that contains "Error:" text
      const content = `
        Error: Something went wrong
      `
      const result = parseTerminal(content)
      // Generic errors no longer trigger error status (confidence < 0.7 threshold)
      expect(result.status).toBe('unknown')
      expect(result.confidence).toBeLessThan(0.7)
    })

    test('detects tool failures', () => {
      const content = `
        Command failed with exit code 1
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('error')
    })

    test('detects rate limits', () => {
      const content = `
        Rate limit exceeded. Please wait.
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('error')
    })

    test('detects permission denied errors', () => {
      const content = `
        Permission denied: cannot write to file
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('error')
    })
  })

  describe('priority handling', () => {
    test('tool failure takes precedence over working', () => {
      // Using tool_failed pattern which has higher confidence (0.85)
      const content = `
        ⠋ Working...
        Command failed with exit code 1
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('error')
    })

    test('waiting takes precedence over idle', () => {
      const content = `
        Task complete!
        Allow this action? [y/n]
      `
      const result = parseTerminal(content)
      expect(result.status).toBe('waiting')
    })
  })
})
