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

  describe('large terminal captures', () => {
    test('detects prompts in last 50 lines of 150-line capture', () => {
      // Generate 120 lines of filler content
      const fillerLines = Array.from({ length: 120 }, (_, i) => `Line ${i + 1}: Some output...`)

      // Add a permission prompt after line 120 (within last 50 lines of total)
      const promptLines = [
        'Context about the operation...',
        'File changes detected:',
        '- Added new feature',
        '- Updated tests',
        'Allow these changes? (Edit)',
        '[y/n]:',
      ]

      const content = [...fillerLines, ...promptLines].join('\n')

      // Parser takes last 50 lines, so prompt at line 121-126 should be detected
      const result = parseTerminal(content)
      expect(result.status).toBe('waiting')
      expect(result.confidence).toBeGreaterThan(0.6)
      expect(result.prompt?.type).toBe('permission')
    })

    test('handles 150-line capture efficiently', () => {
      // Generate exactly 150 lines with working indicator at the end
      const lines = Array.from({ length: 145 }, (_, i) => `Content line ${i + 1}`)
      lines.push('⠋ Working on task...')
      lines.push('Processing files...')
      lines.push('Reading file data...')
      lines.push('Analyzing content...')
      lines.push('⠙ Still working...')

      const content = lines.join('\n')

      const startTime = Date.now()
      const result = parseTerminal(content)
      const duration = Date.now() - startTime

      // Should complete quickly (< 50ms)
      expect(duration).toBeLessThan(50)
      // Should detect working state from spinner in last 50 lines
      expect(result.status).toBe('working')
    })

    test('validates 150-line capture allows deeper prompt detection', () => {
      // Test case: prompt that spans lines 100-110 (would be missed with 100-line capture)
      // Generate 95 lines of normal output
      const prefixLines = Array.from({ length: 95 }, (_, i) => `Output ${i + 1}`)

      // Add prompt context starting at line 96 (would be line 96-110 in capture)
      const promptContext = [
        '',
        'I need to modify several files:',
        '1. src/components/Header.tsx - Add navigation',
        '2. src/pages/Home.tsx - Update content',
        '3. src/lib/api.ts - Add endpoint',
        '',
        'This will affect the following areas:',
        '- User interface navigation',
        '- Home page layout',
        '- API integration',
        '',
        'Allow these changes? (Edit)',
        '[y/n]:',
      ]

      // Add more lines after to reach 150 total
      const suffixLines = Array.from({ length: 38 }, (_, i) => `Additional line ${i + 1}`)

      const content = [...prefixLines, ...promptContext, ...suffixLines].join('\n')

      const result = parseTerminal(content)
      // Prompt is within last 50 lines of 150, should be detected
      expect(result.status).toBe('waiting')
      expect(result.prompt?.type).toBe('permission')
    })
  })
})
