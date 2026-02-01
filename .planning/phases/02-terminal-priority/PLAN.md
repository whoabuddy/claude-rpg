# Phase 2: Elevate Terminal Output Priority - Execution Plan

**Goal:** Ensure terminal_output messages are never dropped under backpressure

**Status:** Planning Complete

## Problem Analysis

After reading the codebase:

1. **Code vs Documentation Discrepancy:**
   - `server-v2/api/messages.ts:157` marks `terminal_output` as `'high'` priority
   - `CLAUDE.md:326` documents it as "low priority, skipped under backpressure"
   - The code is CORRECT - terminal monitoring is critical

2. **Implementation Status:**
   - `server-v2/api/broadcast.ts:139` - High priority messages bypass backpressure
   - `terminal_output` is already in the high priority list
   - The implementation is working as intended

3. **Missing Verification:**
   - No test exists for `broadcast.test.ts` to verify priority handling
   - No sequence numbers for client-side gap detection

## Files to Modify

```
<files>
  <file path="server-v2/api/messages.ts" action="read">
    Current priority implementation (line 157)
  </file>

  <file path="CLAUDE.md" action="update">
    Fix documentation (line 326, 331)
  </file>

  <file path="server-v2/__tests__/broadcast.test.ts" action="create">
    Add priority verification tests
  </file>

  <file path="server-v2/api/broadcast.ts" action="read">
    Reference for test writing
  </file>
</files>
```

## Tasks

### Task 1: Update CLAUDE.md Documentation

**Action:**
Fix `CLAUDE.md` to reflect actual implementation:
- Line 326: Change "low priority, skipped under backpressure" to "high priority, always sent"
- Line 331: Add `terminal_output` to high priority list

**Verify:**
```bash
grep -A 5 "WebSocket Backpressure" CLAUDE.md | grep terminal_output
```

**Expected:** terminal_output appears in high priority list

---

### Task 2: Add Broadcast Priority Tests

**Action:**
Create `server-v2/__tests__/broadcast.test.ts` with tests for:
1. High priority messages (pane_update, terminal_output) bypass backpressure
2. Normal priority messages skip paused clients
3. Low priority messages skip paused clients
4. Backpressure state transitions (pause at HIGH, resume at LOW)

**Verify:**
```bash
cd /home/whoabuddy/dev/whoabuddy/claude-rpg
bun test server-v2/__tests__/broadcast.test.ts
```

**Expected:** All tests pass

---

### Task 3: Consider Sequence Numbers (Optional/Future)

**Action:**
Document recommendation to add sequence numbers in future phase:
- Add `seq: number` to TerminalOutputMessage
- Client can detect gaps and request full refresh
- This is a future enhancement, not blocking for Phase 2

**Verify:**
N/A - Documentation only

**Expected:** Task noted in phase summary

---

## Acceptance Criteria

- [x] `terminal_output` is marked as HIGH priority in `messages.ts:157` (already done)
- [ ] CLAUDE.md correctly documents terminal_output as HIGH priority
- [ ] Test confirms terminal_output sent even when client buffer > 64KB
- [ ] Test confirms normal/low priority messages skip paused clients
- [ ] All tests pass

## Risks

- None. This is a documentation fix + test addition. No code changes to priority logic.

## Dependencies

- None. Phase 2 is independent.

## Notes

The implementation is already correct - terminal_output has been HIGH priority since the backpressure system was added. This phase just fixes the documentation and adds verification tests.
