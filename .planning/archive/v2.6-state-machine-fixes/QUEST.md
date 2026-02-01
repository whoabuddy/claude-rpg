# Quest: v2.6 State Machine Fixes

**Status:** Completed
**Created:** 2026-01-31
**Completed:** 2026-01-31
**Target:** Robust, resilient state machine for claude-rpg

---

## Goal Statement

Implement all fixes identified in the v2.5 Data Tracking Audit to eliminate the "ready while active" bug, reduce false error displays, and improve overall data integrity in the claude-rpg state machine.

## Context

The v2.5 audit (`.planning/archive/v2.5-data-audit/`) identified 9 specific fixes needed:

1. **Reconciler Timeouts**: 3s/5s too aggressive, needs 10s/15s
2. **Hook Precedence Lock**: Terminal polling overrides authoritative hooks
3. **Subagent Tracking**: Missing guard from legacy reconciler
4. **Error Classification**: All errors treated equally, need 3-tier system
5. **Clear Error on Retry**: Error persists through Claude's retry attempts
6. **Error Staleness Check**: Missing 10s timeout from legacy
7. **Targeted pane_update**: Status changes delayed up to 250ms
8. **Events Table Retention**: Unbounded growth risk
9. **IDLE_PATTERNS Confidence**: False positives from checkmarks/Done

## Root Cause Analysis

The audit confirmed the primary root cause of "ready while active":

```
T+0ms:    PreToolUse hook -> status='working'
T+3500ms: Terminal shows idle pattern (checkmark, "Done")
          Reconciler Rule 4 triggers (3s timeout)
          status='idle' (PREMATURE!)
T+5000ms: Stop hook arrives (finally)
          No change (already idle)
```

The v2 reconciler has shorter timeouts (3s/5s) compared to legacy (5s/10s) and lacks:
- Hook precedence locking
- Subagent activity guard
- Error staleness recovery

## Linked Repositories

- **Primary:** claude-rpg (this repo)
- **Reference:** None (self-contained)

## Phases

See [PHASES.md](./PHASES.md) for detailed breakdown:

1. Reconciler Timeout and Precedence Lock (Critical)
2. Subagent Tracking Guard (High)
3. Error Classification System (High)
4. Terminal Pattern Confidence Tuning (Medium)
5. Targeted WebSocket Updates (Medium)
6. Events Table Retention Policy (Low)
7. Verification and Cleanup (Required)

## Success Criteria

- [x] "Ready while active" bug no longer reproducible
- [x] Test failures show as expected errors, not actionable
- [x] Subagent work doesn't trigger parent idle status
- [x] Status changes reach UI within 100ms
- [x] Events table has enforced retention
- [x] All existing tests pass
- [x] Manual verification of all scenarios

## Key Files

| File | Changes |
|------|---------|
| `server-v2/sessions/reconciler.ts` | Timeouts, lock check, subagent guard, error staleness |
| `server-v2/sessions/manager.ts` | lastHookUpdateAt tracking, broadcast trigger |
| `server-v2/sessions/types.ts` | New fields |
| `server-v2/events/handlers.ts` | Error classification, clear on PreToolUse |
| `server-v2/terminal/patterns.ts` | Reduced confidence values |
| `server-v2/db/index.ts` | Events cleanup job |

## Risks

| Risk | Mitigation |
|------|------------|
| Timeouts too long (miss actual idle) | Test with real Claude sessions |
| Error classification logic errors | Conservative defaults (actionable) |
| WebSocket broadcast overhead | Dedupe logic, high priority only for changes |
| Database cleanup affects queries | Run during low activity periods |

## References

- Audit Phase 2: `.planning/archive/v2.5-data-audit/phases/02-state-machine/FINDINGS.md`
- Audit Phase 3: `.planning/archive/v2.5-data-audit/phases/03-error-handling/FINDINGS.md`
- Audit Phase 4: `.planning/archive/v2.5-data-audit/phases/04-storage-persistence/FINDINGS.md`
- Audit Phase 5: `.planning/archive/v2.5-data-audit/phases/05-websocket-ui/FINDINGS.md`
- Legacy reconciler: `server/state-reconciler.ts` (reference for subagent guard)
