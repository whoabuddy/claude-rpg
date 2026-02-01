# Phase 2: State Machine Audit - Findings

**Audit Date:** 2026-01-31
**Phase Status:** Completed

## Executive Summary

The session state machine is well-defined with explicit transition rules, but the reconciliation logic has multiple code paths that can override hook-reported status based on terminal content analysis. This creates a race condition where polling-based terminal updates can override authoritative hook events, leading to the "ready while active" bug.

**Root Cause Confirmed:** The 250ms polling loop calls `updateFromTerminal()` for every Claude pane, which runs the reconciler and can change status from `working` to `idle` based on terminal pattern matching and timeout logic, even when no Stop hook has been received.

---

## 1. State Machine Definition

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/state-machine.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/types.ts`

### Status Values

| Status | Display | Description |
|--------|---------|-------------|
| `idle` | Ready | Task complete, awaiting new prompt |
| `typing` | Active | User activity detected in terminal |
| `working` | Working | Claude actively processing (tool use) |
| `waiting` | Waiting | Claude blocked on user input (has glow) |
| `error` | Error | Tool failed, needs attention |

### Valid State Transitions

```
                   +-----------+
                   |   idle    |
                   +-----------+
                  /  |   |   \  \
                 v   v   v    v  v
           typing  working  waiting  error
              |       |        |       |
              v       |        v       v
            idle <----+     working  idle
              ^       |        |       ^
              |       v        v       |
              +---- waiting ----+------+
                      |
                      v
                   typing
```

**Transition Matrix:**

| From \ To | idle | typing | working | waiting | error |
|-----------|------|--------|---------|---------|-------|
| idle      | -    | Y      | Y       | Y       | Y     |
| typing    | Y    | -      | Y       | Y       | Y     |
| working   | Y    | **N**  | -       | Y       | Y     |
| waiting   | Y    | Y      | Y       | -       | Y     |
| error     | Y    | **N**  | Y       | Y       | -     |

**Invalid Transitions (enforced):**
- `working -> typing`: Cannot type while working
- `error -> typing`: Must clear error first

### Status Priority (for reconciliation)

| Status | Priority | Use Case |
|--------|----------|----------|
| error  | 5        | Highest - errors need attention |
| waiting| 4        | Needs user input |
| working| 3        | Actively processing |
| typing | 2        | User activity |
| idle   | 1        | Lowest - ready state |

---

## 2. Reconciliation Logic

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/reconciler.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server/state-reconciler.ts` (legacy, for comparison)

### Reconciler Input

```typescript
interface ReconciliationInput {
  hookStatus: SessionStatus        // Current status from hooks
  terminalDetection: TerminalDetection  // Parsed terminal state
  timeSinceHookChange: number      // ms since last hook status change
  timeSinceTerminalChange: number  // ms since terminal content changed
}
```

### Reconciliation Rules (in priority order)

| Rule | Condition | Action | Confidence | Issue |
|------|-----------|--------|------------|-------|
| 1 | hook=working, terminal=waiting (>0.7) | Set waiting | terminal | OK - prompt visible |
| 2 | hook=waiting, terminal!=waiting (>0.6) | Set working/terminal | terminal | OK - prompt answered |
| 3 | terminal=error (>0.75) | Set error | terminal | OK - error visible |
| **4** | hook=working, terminal=idle (>0.6), **3s+ since terminal change** | **Set idle** | timeout | **BUG SOURCE** |
| **5** | hook=working, terminal=unknown, **5s+ since hook change** | **Set idle** | timeout | **BUG SOURCE** |
| 6 | terminal confidence <0.5 | Trust hook | hook | OK |
| 7 | terminal confidence >0.8, status!=unknown | Use terminal | terminal | Risky |
| default | All else | Trust hook | hook | OK |

### Timeout Values

| Constant | Value | Purpose | Risk |
|----------|-------|---------|------|
| `IDLE_TIMEOUT_MS` | 3000ms | Trust terminal idle after 3s of working | Too short for slow tools |
| `UNKNOWN_TIMEOUT_MS` | 5000ms | Assume idle after 5s of unknown state | Too short for batch processing |

### Legacy Reconciler Comparison (server/state-reconciler.ts)

The legacy reconciler has different timeout values:
- `PROMPT_RECONCILE_DELAY_MS` = 2000ms (wait before clearing prompts)
- `IDLE_DETECTION_THRESHOLD_MS` = 5000ms (vs current 3000ms)
- `EXTENDED_IDLE_THRESHOLD_MS` = 10000ms (vs current 5000ms)
- `ERROR_STALE_THRESHOLD_MS` = 10000ms

**Finding:** The v2 reconciler has shorter timeouts (3s/5s) compared to legacy (5s/10s), making it more aggressive in overriding hook state.

---

## 3. Session Manager Update Flow

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/index.ts`

### Two Update Paths (Race Condition Source)

**Path 1: Hook Events (authoritative)**
```
Claude Code Hook -> POST /event -> processHookEvent()
  -> eventBus.emit('hook:*')
  -> handlers.ts: updateFromHook(paneId, status)
  -> updateSessionStatus(session, {status, source: 'hook'})
```

**Path 2: Terminal Polling (every 250ms)**
```
startPolling() callback (index.ts line 83-122)
  -> For each Claude pane with terminalContent:
     -> updateFromTerminal(paneId, content)
        -> parseTerminal(content)
        -> reconcile({hookStatus, terminalDetection, times...})
        -> if (result.status !== session.status):
           -> updateSessionStatus(session, {status, source: 'terminal'|'reconciler'})
```

### Race Condition Sequence

```
T+0ms:    Hook sets status='working' (PreToolUse)
T+250ms:  Poll calls updateFromTerminal()
          - Terminal shows spinner (working) - OK
T+500ms:  Poll calls updateFromTerminal()
          - Terminal shows spinner (working) - OK
...
T+3500ms: Poll calls updateFromTerminal()
          - Terminal parser matches IDLE_PATTERNS (checkmark, "Done", shell prompt)
          - confidence > 0.6
          - timeSinceTerminalChange > 3000ms (IDLE_TIMEOUT_MS)
          - Reconciler Rule 4 triggers: sets status='idle'
          - UI shows "Ready" even though Claude is still working

T+4000ms: Hook 'stop' event arrives (finally)
          - updateFromHook(paneId, 'idle')
          - No change (already idle) - transition is silent
```

**Key Issue:** The reconciler can set `idle` BEFORE the Stop hook arrives, and when the Stop hook arrives, it's a no-op because status is already `idle`.

---

## 4. Terminal Parsing

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/terminal/parser.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/terminal/patterns.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/terminal/types.ts`

### Parser Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| MAX_LINES | 50 | Last N lines analyzed |

### Detection Priority (in order)

1. **ERROR_PATTERNS** (confidence >0.7)
2. **WAITING_PATTERNS** (confidence >0.6)
3. **WORKING_PATTERNS** (confidence >0.5)
4. **IDLE_PATTERNS** (confidence >0.4)
5. **unknown** (confidence 0.3)

### Pattern Confidence Values

**WAITING_PATTERNS (highest priority for user attention):**
| Pattern Name | Confidence | Risk |
|--------------|------------|------|
| bash_permission | 0.95 | OK |
| edit_permission | 0.95 | OK |
| write_permission | 0.95 | OK |
| plan_mode | 0.90 | OK |
| arrow_choices | 0.85 | OK |
| choice_prompt | 0.80 | OK |
| generic_permission | 0.70 | Can false-positive |
| question_prompt | 0.60 | Can false-positive |

**WORKING_PATTERNS:**
| Pattern Name | Confidence | Risk |
|--------------|------------|------|
| spinner | 0.90 | OK |
| thinking | 0.85 | OK |
| agent_working | 0.85 | OK |
| tool_executing | 0.70 | Can miss some tools |
| dots_spinner | 0.50 | Too low, easily overridden |

**IDLE_PATTERNS (source of false positives):**
| Pattern Name | Confidence | Risk |
|--------------|------------|------|
| claude_prompt | 0.80 | **HIGH** - Matches mid-output |
| task_complete | 0.70 | Can match mid-output |
| checkmark | 0.60 | Can match mid-output |
| shell_prompt | 0.40 | Very generic |

### Pattern Issues

1. **`claude_prompt` pattern** (`/Claude.*>\s*$/m`, confidence 0.80):
   - Matches any line ending with ">" after "Claude"
   - Can match inside tool output, not just at end
   - High confidence (0.8) means it overrides hooks easily

2. **`checkmark` pattern** (`/[checkmark symbols]/`, confidence 0.60):
   - Matches Unicode checkmarks anywhere in content
   - Tool output often contains checkmarks (test results, git status)
   - Combined with IDLE_TIMEOUT_MS=3000ms, causes premature idle

3. **`task_complete` pattern** (`/Task complete|Done|Finished/i`, confidence 0.70):
   - Matches common words in tool output
   - "Done" appears in many contexts

---

## 5. Gap Analysis: Scenarios Where State Gets Stuck or Misdetected

### Scenario 1: "Ready While Active" Bug (CONFIRMED)

**Trigger:** Long-running tool or slow network
**Sequence:**
1. PreToolUse sets working
2. Terminal shows progress (matched as working)
3. Terminal content stops changing (tool reading large file)
4. 3+ seconds pass with no terminal change
5. Reconciler Rule 4 triggers (terminal idle + timeout)
6. Status set to idle (UI shows "Ready")
7. Tool still running, Claude still processing
8. Stop hook arrives later, no change (already idle)

**Root Cause:** IDLE_TIMEOUT_MS (3000ms) is too short; terminal content hash doesn't change while Claude is thinking.

### Scenario 2: False Positive from Tool Output

**Trigger:** Tool output contains completion patterns
**Sequence:**
1. PreToolUse sets working
2. Bash command runs tests
3. Output contains "Done" or checkmark
4. IDLE_PATTERNS match with >0.6 confidence
5. After 3s, Reconciler Rule 4 triggers
6. Status set to idle while tests still running

**Root Cause:** Confidence threshold too low (0.4 for idle patterns, escalates with timeout).

### Scenario 3: Spinner Not Detected

**Trigger:** Claude Code updates spinner style
**Sequence:**
1. PreToolUse sets working
2. New spinner character not in WORKING_PATTERNS
3. Terminal returns `unknown` or matches idle pattern
4. After 5s, Reconciler Rule 5 triggers
5. Status set to idle

**Root Cause:** Pattern list needs maintenance when Claude Code updates.

### Scenario 4: Subagent Activity Not Tracked

**Trigger:** Main agent spawns subagents
**Sequence:**
1. PreToolUse sets working
2. Subagent started, running in background
3. Main terminal appears idle
4. Reconciler sets idle (no subagent check in v2)
5. Subagent still working

**Root Cause:** v2 reconciler doesn't check for active subagents (legacy did with `hasActiveSubagents` guard).

### Scenario 5: Waiting Status Cleared Prematurely

**Trigger:** User scrolls terminal or content refreshes
**Sequence:**
1. Status is waiting (prompt visible)
2. User scrolls terminal
3. Prompt no longer in last 50 lines
4. Terminal returns `unknown` or `working`
5. Reconciler Rule 2 triggers
6. Status set to working, UI loses waiting indicator
7. Prompt still there, user confused

**Root Cause:** MAX_LINES=50 may not capture prompt after scrolling.

---

## 6. Hypothesis Refinement: "Ready While Active" Bug

### Original Hypothesis (Phase 1)
Race condition between polling callback (`updateFromTerminal`) and hook events.

### Confirmed Root Causes

1. **Primary:** Reconciler Rule 4 (IDLE_TIMEOUT_MS = 3000ms) and Rule 5 (UNKNOWN_TIMEOUT_MS = 5000ms) are too aggressive. They override hook-reported `working` status based on terminal patterns and time-based heuristics.

2. **Secondary:** Terminal IDLE_PATTERNS have high confidence values (0.6-0.8) that exceed the reconciler's threshold (0.5 for low confidence, 0.6+ triggers Rule 4). Common words like "Done" and checkmarks in tool output cause false positives.

3. **Tertiary:** No atomic locking between hook updates and terminal updates. Both paths modify `session.status` independently, and the 250ms polling can race with hook event processing.

### Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| IDLE_TIMEOUT_MS = 3000ms | reconciler.ts:14 | Very short, causes premature idle |
| UNKNOWN_TIMEOUT_MS = 5000ms | reconciler.ts:15 | Short, causes premature idle |
| Legacy had 5s/10s timeouts | server/state-reconciler.ts:14-17 | v2 is more aggressive |
| Rule 4 triggers on terminal idle + timeout | reconciler.ts:87-99 | Confirmed override path |
| Rule 5 triggers on unknown + timeout | reconciler.ts:102-113 | Confirmed override path |
| Poll runs every 250ms | lib/config.ts:34 | Frequent opportunity to override |
| updateFromTerminal in poll callback | index.ts:103 | Confirmed call site |
| No subagent tracking in v2 | reconciler.ts | Missing guard |

---

## 7. Recommendations for Phase 3+

### For Phase 3 (Error Handling Audit)
- Investigate how error state interacts with reconciler
- Check if errors are cleared prematurely by Rule 4/5 timeouts
- Document `clearError()` call sites

### For Phase 5 (WebSocket/UI Audit)
- Check if UI receives conflicting status updates
- Verify status change events are properly ordered
- Check for UI state thrashing from rapid status changes

### Potential Fixes (DO NOT IMPLEMENT - AUDIT ONLY)

1. **Increase timeout values**: IDLE_TIMEOUT_MS to 10s, UNKNOWN_TIMEOUT_MS to 15s
2. **Lower idle pattern confidence**: checkmark 0.4, task_complete 0.5
3. **Add hook precedence**: Hook updates should "lock" status for N seconds
4. **Add subagent tracking**: Check `activeSubagents` before timeout-based idle
5. **Increase MAX_LINES**: 50 -> 100 lines for better prompt detection
6. **Add debouncing**: Don't reconcile if hook event received in last N seconds

---

## Appendix: Key File References

| Purpose | File | Key Code |
|---------|------|----------|
| State machine | `server-v2/sessions/state-machine.ts` | `VALID_SESSION_TRANSITIONS`, `transitionSession()` |
| Reconciler | `server-v2/sessions/reconciler.ts` | `reconcile()`, Rules 1-7 |
| Session manager | `server-v2/sessions/manager.ts` | `updateFromHook()`, `updateFromTerminal()` |
| Terminal parser | `server-v2/terminal/parser.ts` | `parseTerminal()`, `MAX_LINES=50` |
| Patterns | `server-v2/terminal/patterns.ts` | All pattern definitions |
| Poll callback | `server-v2/index.ts` | Lines 83-122 |
| Types | `server-v2/sessions/types.ts` | `SessionStatus`, `ClaudeSession` |
| Legacy reconciler | `server/state-reconciler.ts` | Different timeout values |
