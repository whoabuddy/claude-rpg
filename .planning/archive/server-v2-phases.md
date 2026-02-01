# Phases

## Phase 1: Foundation
**Status:** complete
**Issues:** #115, #116
**Goal:** Set up Bun server foundation with SQLite database.

### Tasks
- [ ] Initialize `server-v2/` directory structure
- [ ] Configure `bunfig.toml` for server
- [ ] Create slim `index.ts` entrypoint
- [ ] Set up Bun.serve() with HTTP/WebSocket
- [ ] Implement graceful shutdown (SIGTERM, SIGINT)
- [ ] Create structured logging module
- [ ] Design and implement SQLite schema
- [ ] Create migration system
- [ ] Implement type-safe query helpers

**Files:** server-v2/index.ts, server-v2/lib/, server-v2/db/

---

## Phase 2: Tmux and Events
**Status:** complete
**Issues:** #117, #118
**Depends on:** Phase 1
**Goal:** Implement tmux polling and event bus for decoupled communication.

### Tasks
- [ ] Create tmux poller with configurable interval
- [ ] Implement process detection for Claude instances
- [ ] Extract working directory for project association
- [ ] Create tmux command wrappers (sendKeys, capturePane, etc.)
- [ ] Implement event bus with typed events
- [ ] Add async handler support with priority ordering
- [ ] Create hook event processor with deduplication

**Files:** server-v2/tmux/, server-v2/events/

---

## Phase 3: Personas and Projects
**Status:** complete
**Issues:** #119, #120
**Depends on:** Phase 2
**Goal:** Implement persona (Claude sessions) and project (git repos) modules.

### Tasks
- [ ] Create persona service with CRUD operations
- [ ] Implement unique name generation (200+ names)
- [ ] Add Bitcoin face avatar fetching with retry
- [ ] Create project service with git detection
- [ ] Extract GitHub remote URL
- [ ] Implement project classification (frontend/backend/infra/blockchain)
- [ ] Wire both modules to event bus

**Files:** server-v2/personas/, server-v2/projects/

---

## Phase 4: XP and Quests
**Status:** complete
**Issues:** #121, #122
**Depends on:** Phase 3
**Goal:** Redesign XP system with ledger and implement quest state machine.

### Tasks
- [ ] Define XP values per event type
- [ ] Create XP ledger (every award tracked)
- [ ] Implement level progression with thresholds
- [ ] Create star chart analytics queries
- [ ] Implement quest state machine (manual, XState-friendly)
- [ ] Add phase management with plan-execute-verify cycle
- [ ] Connect quest completion to XP awards

**Files:** server-v2/xp/, server-v2/quests/

---

## Phase 5: Terminal and Sessions
**Status:** complete
**Issues:** #123, #124
**Depends on:** Phase 2
**Goal:** Implement terminal parsing and session state machine with reconciler.

### Tasks
- [ ] Create centralized pattern registry
- [ ] Implement terminal parser with confidence scoring
- [ ] Add pattern categories (waiting, working, idle, error)
- [ ] Create session state machine with explicit transitions
- [ ] Implement state reconciler (hook vs terminal)
- [ ] Add reconciliation rules for conflict resolution

**Files:** server-v2/terminal/, server-v2/sessions/

---

## Phase 6: API Layer
**Status:** complete
**Issues:** #125, #126
**Depends on:** Phase 3, Phase 4, Phase 5
**Goal:** Implement HTTP routes and Bun WebSocket handlers.

### Tasks
- [ ] Create route organization by domain
- [ ] Implement all HTTP endpoints
- [ ] Add consistent response format
- [ ] Implement input validation
- [ ] Set up Bun.serve() WebSocket upgrade
- [ ] Create message broadcasting with backpressure
- [ ] Add heartbeat/ping-pong for connection health

**Files:** server-v2/api/

---

## Phase 7: Testing
**Status:** complete
**Issues:** #127
**Depends on:** Phase 6
**Goal:** Set up comprehensive test infrastructure and write tests.

### Tasks
- [ ] Configure Bun test runner
- [ ] Create test utilities and helpers
- [ ] Set up in-memory SQLite for tests
- [ ] Write XP system tests (95%+ coverage)
- [ ] Write quest state machine tests (100% coverage)
- [ ] Write session state machine tests (100% coverage)
- [ ] Write terminal parser tests (90%+ coverage)
- [ ] Write API route tests (80%+ coverage)

**Files:** server-v2/__tests__/

---

## Phase 8: Achievements and Polish
**Status:** complete
**Issues:** #129
**Depends on:** Phase 4
**Goal:** Implement achievements system.

### Tasks
- [ ] Define achievement types and criteria
- [ ] Implement achievement checker
- [ ] Connect to XP events
- [ ] Add rarity tiers with visual distinctions
- [ ] Persist achievements to SQLite

**Files:** server-v2/achievements/

---

## Phase 9: Integration
**Status:** complete
**Issues:** #130
**Depends on:** All previous phases
**Goal:** Wire everything together and verify end-to-end.

### Tasks
- [ ] Initialize all modules in correct order
- [ ] Wire event bus subscriptions
- [ ] Connect HTTP routes to services
- [ ] Start tmux polling after init
- [ ] Implement proper startup/shutdown sequence
- [ ] Write integration tests
- [ ] Update deploy scripts
- [ ] Document breaking changes

**Files:** server-v2/index.ts, deploy/
