/**
 * Tests for hash function
 *
 * Verifies collision resistance, determinism, and output format of the
 * 64-bit hash function used for terminal content change detection.
 */

import { describe, test, expect } from 'bun:test'
import { hashContent } from '../lib/hash'

/**
 * Generate random terminal-like content with ANSI codes and realistic patterns
 */
function generateTerminalContent(length: number): string {
  const ansiCodes = [
    '\x1b[0m',  // reset
    '\x1b[1m',  // bold
    '\x1b[32m', // green
    '\x1b[33m', // yellow
    '\x1b[31m', // red
    '\x1b[36m', // cyan
    '\x1b[90m', // gray
  ]

  const patterns = [
    '✓ Task completed',
    '✗ Error occurred',
    '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏', // spinner chars
    'Do you want to proceed? (y/n)',
    'claude>',
    '$ ',
    '[INFO]',
    '[ERROR]',
    'Reading file: ',
    'Writing to: ',
  ]

  let result = ''
  while (result.length < length) {
    // Add random ANSI code
    if (Math.random() < 0.3) {
      result += ansiCodes[Math.floor(Math.random() * ansiCodes.length)]
    }

    // Add random pattern or random text
    if (Math.random() < 0.5) {
      result += patterns[Math.floor(Math.random() * patterns.length)]
    } else {
      // Random alphanumeric or unicode
      if (Math.random() < 0.8) {
        result += String.fromCharCode(32 + Math.floor(Math.random() * 95)) // ASCII printable
      } else {
        result += String.fromCharCode(0x1F300 + Math.floor(Math.random() * 100)) // Unicode emoji range
      }
    }

    // Occasional newline
    if (Math.random() < 0.1) {
      result += '\n'
    }
  }

  return result.slice(0, length)
}

describe('hashContent', function() {
  test('produces 16-character hex string', function() {
    const testCases = [
      '',
      'a',
      'Hello, World!',
      'The quick brown fox jumps over the lazy dog',
      '\x1b[32mGreen text\x1b[0m',
      '🚀 Unicode emoji',
      'A'.repeat(10000),
    ]

    for (const content of testCases) {
      const hash = hashContent(content)

      // Must be exactly 16 characters
      expect(hash.length).toBe(16)

      // Must be valid hex (only 0-9, a-f)
      expect(hash).toMatch(/^[0-9a-f]{16}$/)
    }
  })

  test('is deterministic (same input = same output)', function() {
    const testCases = [
      '',
      'test',
      'Hello, World!',
      '\x1b[32mANSI codes\x1b[0m',
      '🔥 Emoji test 🎉',
      'Binary-like: \x00\x01\x02\xFF',
      generateTerminalContent(1000),
    ]

    for (const content of testCases) {
      const hash1 = hashContent(content)
      const hash2 = hashContent(content)
      const hash3 = hashContent(content)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    }
  })

  test('different inputs produce different hashes', function() {
    const testCases = [
      ['a', 'b'],
      ['test', 'Test'],
      ['hello', 'world'],
      ['', ' '],
      ['foo\n', 'foo'],
      ['\x1b[32m', '\x1b[33m'],
    ]

    for (const [content1, content2] of testCases) {
      const hash1 = hashContent(content1)
      const hash2 = hashContent(content2)

      expect(hash1).not.toBe(hash2)
    }
  })

  test('no collisions in 100k random terminal samples', { timeout: 30000 }, function() {
    const sampleCount = 100_000
    const hashes = new Set<string>()
    const contents = new Set<string>()

    for (let i = 0; i < sampleCount; i++) {
      // Generate random terminal content (varying lengths)
      const length = 100 + Math.floor(Math.random() * 9900) // 100-10000 chars
      const content = generateTerminalContent(length)

      // Skip if we generated duplicate content (unlikely but possible)
      if (contents.has(content)) {
        continue
      }
      contents.add(content)

      const hash = hashContent(content)

      // Check for collision
      if (hashes.has(hash)) {
        throw new Error(`Collision detected at sample ${i}: hash ${hash}`)
      }

      hashes.add(hash)
    }

    // Verify we actually tested unique content
    expect(contents.size).toBeGreaterThan(99_000) // Allow for some dups
    expect(hashes.size).toBe(contents.size)
  })

  test('detects single character changes', function() {
    const base = 'The quick brown fox jumps over the lazy dog'
    const baseHash = hashContent(base)

    // Change each character position
    for (let i = 0; i < base.length; i++) {
      const modified = base.slice(0, i) + 'X' + base.slice(i + 1)
      const modifiedHash = hashContent(modified)

      expect(modifiedHash).not.toBe(baseHash)
    }
  })

  test('handles edge cases', function() {
    const edgeCases = [
      '',                                    // empty
      '\x00',                                // null byte
      '\n',                                  // single newline
      ' '.repeat(10000),                     // all spaces
      'A'.repeat(100000),                    // very long (100KB)
      '\uFFFD'.repeat(100),                  // replacement character
      '🔥'.repeat(1000),                     // emoji heavy
      '\x1b[38;5;196m'.repeat(1000),        // ANSI heavy
    ]

    const hashes = new Set<string>()

    for (const content of edgeCases) {
      const hash = hashContent(content)

      // Valid format
      expect(hash).toMatch(/^[0-9a-f]{16}$/)

      // Unique
      expect(hashes.has(hash)).toBe(false)
      hashes.add(hash)
    }
  })

  test('handles incremental terminal changes realistically', function() {
    // Simulate terminal output growing line by line
    let terminal = 'claude> Starting task...\n'
    const hashes = new Set<string>()

    hashes.add(hashContent(terminal))

    // Add 100 lines incrementally
    for (let i = 0; i < 100; i++) {
      terminal += `\x1b[32m✓\x1b[0m Step ${i} completed\n`
      const hash = hashContent(terminal)

      // Each addition should produce unique hash
      expect(hashes.has(hash)).toBe(false)
      hashes.add(hash)
    }

    expect(hashes.size).toBe(101) // Initial + 100 additions
  })

  test('performance sanity check', function() {
    // Hash 10k strings of varying length
    // Should complete in < 100ms on typical hardware
    const startTime = performance.now()

    for (let i = 0; i < 10_000; i++) {
      const length = 100 + (i % 9900) // 100-10000 chars
      const content = generateTerminalContent(length)
      hashContent(content)
    }

    const elapsed = performance.now() - startTime

    // This is a sanity check, not a strict requirement
    // Bun.hash should be very fast (non-cryptographic)
    expect(elapsed).toBeLessThan(1000) // 1 second for 10k hashes
  })
})
