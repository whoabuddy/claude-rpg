/**
 * Terminal pattern fixture tests
 *
 * Validates that patterns correctly detect state from real terminal captures
 */

import { describe, test, expect } from 'bun:test'
import { parseTerminal } from '../../terminal/parser'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const FIXTURES_DIR = join(__dirname, '../../terminal/test-fixtures')

describe('pattern fixtures', () => {
  describe('permission prompts', () => {
    test('detects permission-bash.txt as waiting', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'permission-bash.txt'), 'utf-8')
      const result = parseTerminal(content)

      expect(result.status).toBe('waiting')
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.matchedPattern).toBeDefined()
    })

    test('detects permission-edit.txt as waiting', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'permission-edit.txt'), 'utf-8')
      const result = parseTerminal(content)

      expect(result.status).toBe('waiting')
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.matchedPattern).toBeDefined()
    })
  })

  describe('question prompts', () => {
    test('detects question-multi-option.txt as waiting', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'question-multi-option.txt'), 'utf-8')
      const result = parseTerminal(content)

      expect(result.status).toBe('waiting')
      expect(result.confidence).toBeGreaterThan(0.65)
      expect(result.matchedPattern).toBeDefined()
    })
  })

  describe('plan prompts', () => {
    test('detects plan-approval.txt as waiting', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'plan-approval.txt'), 'utf-8')
      const result = parseTerminal(content)

      expect(result.status).toBe('waiting')
      expect(result.confidence).toBeGreaterThan(0.65)
      expect(result.matchedPattern).toBeDefined()
    })
  })

  describe('feedback prompts', () => {
    test('detects feedback-rating.txt as waiting', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'feedback-rating.txt'), 'utf-8')
      const result = parseTerminal(content)

      // Feedback prompts use question or generic patterns
      expect(result.status).toBe('waiting')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.matchedPattern).toBeDefined()
    })
  })

  describe('working state', () => {
    test('detects working-spinner.txt as working', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'working-spinner.txt'), 'utf-8')
      const result = parseTerminal(content)

      expect(result.status).toBe('working')
      expect(result.confidence).toBeGreaterThan(0.6)
      expect(result.matchedPattern).toBeDefined()
    })
  })

  describe('error state', () => {
    test('detects error-tool-failed.txt as error', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'error-tool-failed.txt'), 'utf-8')
      const result = parseTerminal(content)

      expect(result.status).toBe('error')
      expect(result.confidence).toBeGreaterThan(0.75)
      expect(result.matchedPattern).toBe('tool_failed')
      expect(result.error).toBeDefined()
    })
  })

  describe('idle state', () => {
    test('detects idle-prompt.txt as idle', async () => {
      const content = readFileSync(join(FIXTURES_DIR, 'idle-prompt.txt'), 'utf-8')
      const result = parseTerminal(content)

      expect(result.status).toBe('idle')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.matchedPattern).toBeDefined()
    })
  })

  describe('fixture structure validation', () => {
    test('all fixtures exist and have expected structure', () => {
      const expectedFixtures = [
        'permission-bash.txt',
        'permission-edit.txt',
        'question-multi-option.txt',
        'plan-approval.txt',
        'feedback-rating.txt',
        'working-spinner.txt',
        'error-tool-failed.txt',
        'idle-prompt.txt',
      ]

      const files = readdirSync(FIXTURES_DIR)
      const txtFiles = files.filter(f => f.endsWith('.txt'))

      // Check all expected fixtures exist
      expectedFixtures.forEach(fixture => {
        expect(txtFiles).toContain(fixture)
      })

      // Check each fixture has expected structure
      txtFiles.forEach(file => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')

        // Non-empty
        expect(content.length).toBeGreaterThan(100)

        // Multi-line
        expect(content.split('\n').length).toBeGreaterThan(10)

        // Has header comment
        expect(content).toMatch(/^\/\*\*/)
        expect(content).toContain('Fixture:')
        expect(content).toContain('Expected status:')
      })
    })

    test('fixtures cover all 5 prompt types', () => {
      const files = readdirSync(FIXTURES_DIR)

      // Check for coverage
      expect(files.some(f => f.includes('permission'))).toBe(true)
      expect(files.some(f => f.includes('question'))).toBe(true)
      expect(files.some(f => f.includes('plan'))).toBe(true)
      expect(files.some(f => f.includes('feedback'))).toBe(true)
      expect(files.some(f => f.includes('working'))).toBe(true)
      expect(files.some(f => f.includes('error'))).toBe(true)
      expect(files.some(f => f.includes('idle'))).toBe(true)
    })
  })

  describe('regression detection', () => {
    test('all fixtures parse successfully', () => {
      const files = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.txt'))

      let successCount = 0
      let failureCount = 0

      files.forEach(file => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const result = parseTerminal(content)

        // Should always detect something (not unknown with low confidence)
        if (result.status !== 'unknown' && result.confidence > 0.4) {
          successCount++
        } else {
          failureCount++
          console.warn(`Warning: ${file} detected as ${result.status} with confidence ${result.confidence}`)
        }
      })

      // At least 85% should parse successfully
      const successRate = successCount / files.length
      expect(successRate).toBeGreaterThan(0.85)
    })
  })
})
