# Data Tracking Audit - Phases

## Goal

Audit data tracking, storage, and display systems in claude-rpg to identify:
1. Data flow from tmux/hooks to UI
2. State machine flows for session status (ready/working/waiting/error)
3. Storage patterns (SQLite, in-memory)
4. UI display logic and staleness/correctness issues

## Known Issues

- **State Mismatch**: Agents showing "ready" while terminal shows active work
- **False Error Display**: Errors displayed for non-actionable chain events (expected/handled errors)

---

## Phase 1: Data Ingestion Audit [COMPLETED]

**Status**: Completed 2026-01-31
**Findings**: `.planning/phases/01-data-ingestion/FINDINGS.md`

**Goal**: Document all entry points where data enters the system

**Focus Areas**:
1. Tmux polling mechanism (`server-v2/tmux/poller.ts`, `server-v2/tmux/index.ts`)
2. Hook event processing (`server-v2/events/hooks.ts`, `server-v2/events/handlers.ts`)
3. Event normalization and routing (`server-v2/events/bus.ts`)

**Files to Review**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/poller.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/index.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/process.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/hooks.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/bus.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/types.ts`

**Deliverable**: Document mapping of:
- How often tmux is polled (250ms per CLAUDE.md)
- What fields are extracted from tmux
- Which hook events are processed (PreToolUse, PostToolUse, Stop, etc.)
- How hooks correlate with tmux panes (paneId, tmuxTarget)
- Any race conditions between polling and hook events

---

## Phase 2: State Machine Audit [COMPLETED]

**Status**: Completed 2026-01-31
**Findings**: `.planning/phases/02-state-machine/FINDINGS.md`

**Goal**: Document and validate the session status state machine

**Focus Areas**:
1. State machine definition (`server-v2/sessions/state-machine.ts`)
2. State reconciliation logic (`server-v2/sessions/reconciler.ts`)
3. Session manager updates (`server-v2/sessions/manager.ts`)
4. Terminal parsing for status detection (`server-v2/terminal/parser.ts`, `server-v2/terminal/patterns.ts`)

**Files to Review**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/state-machine.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/reconciler.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/types.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/terminal/parser.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/terminal/patterns.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/terminal/types.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/__tests__/sessions/state-machine.test.ts`

**Deliverable**: Document:
- Valid state transitions (idle, typing, working, waiting, error)
- Reconciliation rules and their confidence thresholds
- Timeout values (IDLE_TIMEOUT_MS=3000, UNKNOWN_TIMEOUT_MS=5000)
- Gap analysis: scenarios where state can get stuck or misdetected
- Root cause hypothesis for "ready while active" bug

---

## Phase 3: Error Handling Audit [COMPLETED]

**Status**: Completed 2026-01-31
**Findings**: `.planning/phases/03-error-handling/FINDINGS.md`

**Goal**: Trace error propagation and identify false positives

**Focus Areas**:
1. Error state setting in event handlers (`server-v2/events/handlers.ts` lines 159-173)
2. Error clearing logic (`clearError()` in session manager)
3. Error display in UI (`src/components/PaneCard.tsx` lines 71-122)
4. Error patterns in terminal detection (`server-v2/terminal/patterns.ts` ERROR_PATTERNS)

**Files to Review**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts` (error handling section)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts` (clearError function)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/terminal/patterns.ts` (ERROR_PATTERNS)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx` (error display)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/shared/types.ts` (SessionError interface)

**Deliverable**: Document:
- When errors are set (PostToolUseEvent with success=false)
- When errors are cleared (user prompt, stop, successful tool)
- UI auto-dismiss timing (5s fade out)
- Identify which error types are "expected" (chain events, retries) vs actionable
- Proposed error classification scheme

---

## Phase 4: Storage and Persistence Audit [COMPLETED]

**Status**: Completed 2026-01-31
**Findings**: `.planning/phases/04-storage-persistence/FINDINGS.md`

**Goal**: Document what gets persisted vs held in memory

**Focus Areas**:
1. SQLite schema (`server-v2/db/schema.ts`)
2. In-memory session cache (`server-v2/sessions/manager.ts`)
3. XP ledger and stats (`server-v2/xp/ledger.ts`, `server-v2/companions/service.ts`)
4. What survives server restart vs what is lost

**Files to Review**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/db/schema.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/db/queries.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/db/index.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts` (sessions Map)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/xp/ledger.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/companions/service.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/personas/service.ts`

**Deliverable**: Document:
- SQLite tables: personas, projects, xp_events, stats, quests, achievements, events, notes
- In-memory caches: sessions Map, terminal content, timestamps
- Data that survives restart: XP, stats, personas, projects
- Data that is lost: active session status, terminal content, current tool
- Staleness risks from memory/DB desync

---

## Phase 5: WebSocket and UI Display Audit [COMPLETED]

**Status**: Completed 2026-01-31
**Findings**: `.planning/phases/05-websocket-ui/FINDINGS.md`

**Goal**: Trace data from server to UI display

**Focus Areas**:
1. WebSocket message types and broadcast (`server-v2/api/ws.ts`, `server-v2/api/broadcast.ts`)
2. Client WebSocket handling (`src/lib/websocket.ts`)
3. Zustand store updates (`src/store/index.ts`)
4. Component rendering (`src/components/PaneCard.tsx`, `src/components/StatusIndicator.tsx`)

**Files to Review**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/ws.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/broadcast.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/messages.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/lib/websocket.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/store/index.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/StatusIndicator.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/utils/pane-status.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/shared/types.ts` (ServerMessage types)

**Deliverable**: Document:
- Message priority (high: pane_update/removed, normal: windows/companions, low: terminal_output/event)
- Backpressure behavior (64KB buffer pause, 16KB resume)
- Client store update flow
- UI rendering triggers
- Potential staleness from backpressure or dropped messages

---

## Phase 6: Open Questions Review

**Goal**: Human checkpoint to review findings and prioritize fixes

**Focus Areas**:
1. Review audit findings from Phases 1-5
2. Validate root cause hypotheses for known issues
3. Prioritize fixes vs documentation updates
4. Identify any security or data integrity concerns

**Deliverable**:
- Summary of all findings with severity ratings
- Confirmed root causes for:
  - "Ready while active" state mismatch
  - False error display for expected failures
- Prioritized list of recommended changes
- Questions requiring human decision:
  - Should some errors be suppressed entirely?
  - Should reconciliation timeouts be adjusted?
  - Should state transitions be logged for debugging?
  - Are there any data integrity concerns with the dual memory/DB model?

---

## Dependencies

```
Phase 1 (Data Ingestion)
    |
    v
Phase 2 (State Machine) --+
    |                     |
    v                     v
Phase 3 (Error Handling)  Phase 4 (Storage)
    |                     |
    +----------+----------+
               |
               v
       Phase 5 (WebSocket/UI)
               |
               v
       Phase 6 (Review) [HUMAN CHECKPOINT]
```

Phases 2-4 can be partially parallelized after Phase 1 completes.
Phase 5 depends on understanding from Phases 2-4.
Phase 6 requires all other phases complete.
