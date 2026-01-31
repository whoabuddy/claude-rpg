# v2.6 State Machine Fixes - Phases

**Goal:** Implement all fixes from Data Tracking Audit to create a robust, resilient state machine for claude-rpg.

**Base Branch:** main
**Target:** Eliminate "ready while active" bug, reduce false error displays, improve data integrity

---

## Phase 1: Reconciler Timeout and Precedence Lock [COMPLETED]

**Goal:** Prevent reconciler from prematurely overriding hook-reported status

**Status:** Completed (2026-01-31)

**Dependencies:** None (foundation phase)

**Fixes Addressed:**
- Fix 1: Increase reconciler timeouts from 3s/5s to 10s/15s
- Fix 2: Implement hook precedence lock (5s window after hook event)

**Key Files:**
- `server-v2/sessions/reconciler.ts` - Timeout constants, add lock check
- `server-v2/sessions/manager.ts` - Track lastHookUpdateAt timestamp
- `server-v2/sessions/types.ts` - Add lastHookUpdateAt to ClaudeSession

**Tests Required:**
- Reconciler respects IDLE_TIMEOUT_MS=10000ms
- Reconciler respects UNKNOWN_TIMEOUT_MS=15000ms
- Reconciler skips override when within 5s of hook event
- Hook events always update status (precedence over terminal)

**Acceptance Criteria:**
- Timeout constants changed to 10s/15s
- New `lastHookUpdateAt` field tracks hook event timing
- Reconciler checks `timeSinceHookEvent < 5000` before override
- Unit tests pass for all timeout scenarios

---

## Phase 2: Subagent Tracking Guard [COMPLETED]

**Goal:** Prevent idle detection when subagents are still running

**Status:** Completed (2026-01-31)

**Dependencies:** Phase 1 (builds on reconciler changes)

**Fixes Addressed:**
- Fix 3: Add back hasActiveSubagents guard from legacy reconciler

**Key Files:**
- `server-v2/sessions/reconciler.ts` - Add subagent check to Rules 4/5
- `server-v2/sessions/manager.ts` - Pass activeSubagents to reconciler
- `server-v2/sessions/types.ts` - Update ReconciliationInput if needed
- `shared/types.ts` - Verify SubagentInfo is accessible

**Tests Required:**
- Reconciler does NOT set idle when activeSubagents.length > 0
- Reconciler allows idle when activeSubagents is empty/undefined
- Subagent state is correctly passed through reconciliation flow

**Acceptance Criteria:**
- Rules 4 and 5 include `hasActiveSubagents` guard
- Status stays working/waiting when subagents active
- Legacy behavior parity verified

---

## Phase 3: Error Classification System [COMPLETED]

**Goal:** Distinguish actionable errors from expected/transient ones

**Status:** Completed (2026-01-31)

**Dependencies:** None (can run in parallel with Phase 1-2)

**Fixes Addressed:**
- Fix 4: Implement 3-tier error classification (actionable/expected/transient)
- Fix 5: Clear error state when PreToolUse arrives
- Fix 6: Add server-side 10s error staleness check

**Key Files:**
- `server-v2/sessions/types.ts` - Add errorClass field to SessionError
- `server-v2/events/handlers.ts` - Classify errors on PostToolUse, clear on PreToolUse
- `server-v2/sessions/reconciler.ts` - Add error staleness rule from legacy
- `server-v2/terminal/patterns.ts` - Reduce ERROR_PATTERNS confidence (0.8 -> 0.6)

**Error Classification Logic:**
- `'transient'`: Followed by PreToolUse within 2s (retry pattern)
- `'expected'`: Test failures, git exit codes, lint errors (known tools)
- `'actionable'`: Everything else (needs user attention)

**Tests Required:**
- PreToolUse clears previous error state
- Error staleness (>10s) triggers status recovery
- Transient errors (retry within 2s) not displayed prominently
- Expected errors auto-dismiss faster than actionable

**Acceptance Criteria:**
- SessionError has errorClass: 'actionable' | 'expected' | 'transient'
- PreToolUse event calls clearError() before setting working
- Reconciler clears stale errors after 10s
- Lower ERROR_PATTERNS confidence to 0.6

---

## Phase 4: Terminal Pattern Confidence Tuning [COMPLETED]

**Goal:** Reduce false positive idle detections from terminal content

**Status:** Completed (2026-01-31)

**Dependencies:** Phases 1-3 (refinement phase)

**Fixes Addressed:**
- Fix 9: Lower IDLE_PATTERNS confidence to reduce false positives

**Key Files:**
- `server-v2/terminal/patterns.ts` - Adjust IDLE_PATTERNS confidence values

**Pattern Changes:**
- `checkmark`: 0.6 -> 0.4 (common in test output)
- `task_complete`: 0.7 -> 0.5 ("Done" appears in many contexts)
- `claude_prompt`: 0.8 -> 0.6 (can match mid-output)

**Tests Required:**
- Checkmarks in test output don't trigger idle
- "Done" in tool output doesn't trigger idle
- Actual Claude prompt (end of session) still detected
- Overall detection accuracy maintained

**Acceptance Criteria:**
- IDLE_PATTERNS have reduced confidence values
- False positive rate reduced (manual verification)
- Legitimate idle detection still works

---

## Phase 5: Targeted WebSocket Updates [COMPLETED]

**Goal:** Broadcast status changes immediately instead of waiting for windows poll

**Status:** Completed (2026-01-31)

**Dependencies:** Phases 1-2 (status must be correct before optimizing delivery)

**Fixes Addressed:**
- Fix 7: Broadcast targeted pane_update on status change

**Key Files:**
- `server-v2/sessions/manager.ts` - Emit pane_update after status change
- `server-v2/api/broadcast.ts` - Ensure pane_update uses high priority
- `server-v2/events/handlers.ts` - Trigger broadcast after updateFromHook

**Implementation:**
- After `updateSessionStatus()` succeeds, broadcast `pane_update` message
- Include full pane state in update (not just status)
- Ensure message priority is HIGH for reliable delivery

**Tests Required:**
- Status change triggers immediate pane_update broadcast
- pane_update has high priority (not dropped under backpressure)
- Client receives status change within 50ms of hook event

**Acceptance Criteria:**
- pane_update broadcast added to updateSessionStatus flow
- Status changes visible in UI within 50ms (vs 0-250ms before)
- No duplicate status updates (dedupe logic)

---

## Phase 6: Events Table Retention Policy

**Goal:** Prevent unbounded database growth

**Dependencies:** None (can run in parallel)

**Fixes Addressed:**
- Fix 8: Add cleanup policy for events table

**Key Files:**
- `server-v2/db/index.ts` - Schedule periodic cleanup
- `server-v2/db/queries.ts` - Verify deleteOldEvents query works
- `server-v2/lib/config.ts` - Add eventsRetentionDays config (default: 7)

**Implementation:**
- Add scheduled job (daily) to delete events older than retention period
- Alternative: Enforce row limit (keep last 10000 events)
- Log cleanup actions for monitoring

**Tests Required:**
- Events older than retention period are deleted
- Recent events are preserved
- Cleanup doesn't affect other tables

**Acceptance Criteria:**
- Events table has enforced retention policy
- Database file size stabilizes over time
- Cleanup logged for monitoring

---

## Phase 7: Verification and Cleanup

**Goal:** Verify all fixes work together, clean up implementation

**Dependencies:** Phases 1-6 (final phase)

**Tasks:**
1. Run full test suite (bun test)
2. Manual testing: Create scenarios that triggered original bugs
3. Verify reconciler behavior with extended timeouts
4. Verify error classification in real usage
5. Check WebSocket update latency
6. Document any remaining edge cases

**Verification Scenarios:**
- [ ] Long-running Bash command (>10s) stays "Working"
- [ ] Test failures show as "expected" errors, auto-dismiss in 2s
- [ ] Subagent work doesn't trigger parent idle
- [ ] PreToolUse after error clears error state
- [ ] Status change reaches UI within 100ms
- [ ] Events table stays under 10000 rows

**Cleanup Tasks:**
- Remove any debug logging added during implementation
- Update CLAUDE.md with new timeout values
- Archive audit findings to .planning/archive
- Create release notes for v2.6

**Acceptance Criteria:**
- All tests pass
- No regression in existing functionality
- Documentation updated
- Performance benchmarks acceptable

---

## Summary

| Phase | Fixes | Est. Tasks | Priority |
|-------|-------|------------|----------|
| 1. Reconciler Timeouts | 1, 2 | 3 | Critical |
| 2. Subagent Guard | 3 | 2 | High |
| 3. Error Classification | 4, 5, 6 | 4 | High |
| 4. Pattern Confidence | 9 | 2 | Medium |
| 5. WebSocket Updates | 7 | 3 | Medium |
| 6. Events Retention | 8 | 2 | Low |
| 7. Verification | - | 2 | Required |

**Parallelization:**
- Phases 1-2 must be sequential (reconciler foundation)
- Phase 3 can run in parallel with 1-2 (error system is separate)
- Phase 4 depends on 1-3 (refinement)
- Phase 5 depends on 1-2 (correct status before fast delivery)
- Phase 6 can run in parallel (database only)
- Phase 7 must be last (verification)

**Total Estimated Tasks:** 18
