# Phase 7: Testing

## Goal
Set up comprehensive test infrastructure and write tests for all modules.

## Context
- Bun's built-in test runner: `bun test`
- In-memory SQLite for isolated tests
- Target coverage: 80%+ overall, 100% for state machines
- Issue: #127

<plan>
  <goal>Create test infrastructure and achieve 80%+ coverage</goal>
  <context>
    - Bun test API: import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
    - In-memory SQLite: new Database(':memory:')
    - Mock external services (bitcoinfaces.xyz, tmux)
  </context>

  <task id="1">
    <name>Set up test infrastructure</name>
    <files>server-v2/__tests__/setup.ts, server-v2/__tests__/helpers.ts, server-v2/__tests__/mocks/index.ts</files>
    <action>
      1. Create __tests__/setup.ts:
         - Initialize in-memory database
         - Run migrations
         - Export test database instance
         - Cleanup function
      2. Create __tests__/helpers.ts:
         - createTestPersona(): Persona
         - createTestProject(): Project
         - createTestQuest(): Quest
         - waitForEvent(bus, type): Promise<Event>
      3. Create __tests__/mocks/index.ts:
         - mockTmux: fake window/pane data
         - mockBitcoinFace: return test SVG
         - mockGit: fake repo info
    </action>
    <verify>
      Run setup, verify in-memory DB created with tables
    </verify>
    <done>Test infrastructure ready for all modules</done>
  </task>

  <task id="2">
    <name>Write core module tests</name>
    <files>server-v2/__tests__/xp/*.test.ts, server-v2/__tests__/quests/*.test.ts, server-v2/__tests__/sessions/*.test.ts</files>
    <action>
      1. Create __tests__/xp/calculator.test.ts:
         - Test XP values for all event types
         - Test edge cases (unknown types)
      2. Create __tests__/xp/levels.test.ts:
         - Test xpForLevel at various levels
         - Test levelFromTotalXp with boundary values
         - Test level titles
      3. Create __tests__/xp/ledger.test.ts:
         - Test recordXpEvent creates DB entry
         - Test getXpByCategory aggregation
         - Test getXpTimeline date filtering
      4. Create __tests__/quests/state-machine.test.ts:
         - Test all valid transitions
         - Test all invalid transitions throw
         - 100% coverage of transition table
      5. Create __tests__/sessions/state-machine.test.ts:
         - Test all valid transitions
         - Test all invalid transitions throw
         - 100% coverage of transition table
      6. Create __tests__/sessions/reconciler.test.ts:
         - Test each reconciliation rule
         - Test timing-based transitions
    </action>
    <verify>
      bun test server-v2/__tests__/xp
      bun test server-v2/__tests__/quests
      bun test server-v2/__tests__/sessions
      All tests pass
    </verify>
    <done>Core modules have comprehensive tests</done>
  </task>

  <task id="3">
    <name>Write terminal and API tests</name>
    <files>server-v2/__tests__/terminal/*.test.ts, server-v2/__tests__/api/*.test.ts</files>
    <action>
      1. Create __tests__/terminal/parser.test.ts:
         - Test each pattern category
         - Test real terminal output samples
         - Test confidence scoring
         - Test prompt extraction
      2. Create __tests__/terminal/fixtures.ts:
         - Sample terminal outputs for each state
         - Permission prompts, question prompts
         - Working states, idle states
      3. Create __tests__/api/routes.test.ts:
         - Test each HTTP endpoint
         - Test error responses
         - Test invalid requests
      4. Create __tests__/api/ws.test.ts:
         - Test WebSocket connection
         - Test message broadcasting
         - Test backpressure behavior
    </action>
    <verify>
      bun test server-v2/__tests__/terminal
      bun test server-v2/__tests__/api
      All tests pass
    </verify>
    <done>Terminal parsing and API have comprehensive tests</done>
  </task>
</plan>

## Verification Criteria
- [ ] `bun test` runs all tests
- [ ] XP system tests: 95%+ coverage
- [ ] State machine tests: 100% coverage
- [ ] Terminal parser tests: 90%+ coverage
- [ ] API route tests: 80%+ coverage
- [ ] All tests pass
