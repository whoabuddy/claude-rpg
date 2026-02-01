#!/usr/bin/env bun
/**
 * Pattern validation CLI tool
 *
 * Tests all terminal patterns against saved fixtures to detect regressions.
 * Run after updating patterns or upgrading Claude Code.
 *
 * Usage:
 *   bun run test:patterns
 *   bun scripts/test-patterns.ts
 */

import { parseTerminal } from '../server-v2/terminal/parser'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const FIXTURES_DIR = join(__dirname, '../server-v2/terminal/test-fixtures')

interface TestResult {
  fixture: string
  expected: string
  actual: string
  confidence: number
  passed: boolean
}

async function testPatterns(): Promise<void> {
  console.log('🔍 Testing terminal patterns against fixtures...\n')

  const fixtures = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.txt'))

  if (fixtures.length === 0) {
    console.error('❌ No fixtures found in', FIXTURES_DIR)
    process.exit(1)
  }

  const results: TestResult[] = []
  let passed = 0
  let failed = 0

  for (const fixture of fixtures) {
    const content = readFileSync(join(FIXTURES_DIR, fixture), 'utf-8')
    const result = parseTerminal(content)
    const name = fixture.replace('.txt', '')

    // Determine expected status from filename
    const expectedStatus = getExpectedStatus(name)

    const statusMatch =
      (expectedStatus === 'waiting' && result.status === 'waiting') ||
      (expectedStatus === 'working' && result.status === 'working') ||
      (expectedStatus === 'error' && result.status === 'error') ||
      (expectedStatus === 'idle' && result.status === 'idle')

    const testResult: TestResult = {
      fixture: name,
      expected: expectedStatus,
      actual: result.status,
      confidence: result.confidence,
      passed: statusMatch,
    }

    results.push(testResult)

    if (statusMatch) {
      console.log(`✓ ${name}`)
      console.log(`  Status: ${result.status} (confidence: ${result.confidence.toFixed(2)})`)
      console.log(`  Pattern: ${result.matchedPattern || 'none'}`)
      passed++
    } else {
      console.log(`✗ ${name}`)
      console.log(`  Expected: ${expectedStatus}`)
      console.log(`  Actual: ${result.status} (confidence: ${result.confidence.toFixed(2)})`)
      console.log(`  Pattern: ${result.matchedPattern || 'none'}`)
      failed++
    }
    console.log()
  }

  // Summary
  console.log('─'.repeat(60))
  console.log(`\nResults: ${passed} passed, ${failed} failed (${fixtures.length} total)`)

  const successRate = (passed / fixtures.length) * 100
  console.log(`Success rate: ${successRate.toFixed(1)}%`)

  if (failed > 0) {
    console.log('\n⚠️  Some patterns failed. Review pattern definitions in server-v2/terminal/patterns.ts')
    console.log('   or update fixtures to match current Claude Code output.\n')
    process.exit(1)
  } else {
    console.log('\n✅ All patterns validated successfully!\n')
    process.exit(0)
  }
}

/**
 * Determine expected status from fixture filename
 */
function getExpectedStatus(filename: string): string {
  // Map filename prefix to expected status
  if (filename.startsWith('permission-')) return 'waiting'
  if (filename.startsWith('question-')) return 'waiting'
  if (filename.startsWith('plan-')) return 'waiting'
  if (filename.startsWith('feedback-')) return 'waiting'
  if (filename.startsWith('working-')) return 'working'
  if (filename.startsWith('error-')) return 'error'
  if (filename.startsWith('idle-')) return 'idle'

  // Fallback: parse from fixture header comment
  const content = readFileSync(join(FIXTURES_DIR, `${filename}.txt`), 'utf-8')
  const match = content.match(/Expected status:\s*(\w+)/)
  if (match) return match[1]

  return 'unknown'
}

// Run tests
testPatterns()
