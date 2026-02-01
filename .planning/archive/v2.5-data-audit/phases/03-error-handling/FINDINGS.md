# Phase 3: Error Handling Audit - Findings

**Audit Date:** 2026-01-31
**Phase Status:** Completed

## Executive Summary

The error handling system has a straightforward lifecycle: errors are set when tools fail (`PostToolUseEvent` with `success=false`) and cleared by subsequent successful actions or session transitions. However, the system lacks **error classification** - all tool failures are treated equally, causing "false positive" error displays for expected/handled failures like chain events, retries, and recoverable errors that Claude handles automatically.

**Root Cause of False Error Display:** When a tool fails as part of a retry or chain (e.g., `git commit` fails, Claude retries with different options), the UI shows an error state even though Claude is continuing to work. The user sees an error badge, but no action is needed.

---

## 1. Error Lifecycle

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts` (lines 159-173)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts` (clearError function)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/reconciler.ts` (Rule 3 - terminal error)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx` (lines 71-122)

### Error State Flow Diagram

```
                    ┌──────────────────────────────────────────────────────┐
                    │                   ERROR LIFECYCLE                     │
                    └──────────────────────────────────────────────────────┘

┌─────────────────────┐
│   ERROR SET         │
│   (3 triggers)      │
└─────────────────────┘
         │
         ├── 1. PostToolUseEvent (success=false)
         │      → handlers.ts:160-169
         │      → session.lastError = {tool, message, timestamp}
         │      → updateFromHook(paneId, 'error')
         │
         ├── 2. Terminal Parser (ERROR_PATTERNS match)
         │      → parser.ts:35-42
         │      → TerminalDetection{status: 'error', confidence: 0.8+}
         │      → Reconciler Rule 3 (>0.75 confidence)
         │      → reconciler.ts:74-85
         │
         └── 3. Discord Notification (on status change)
                → handlers.ts:298-300 (notifyError)

                         │
                         ▼

┌─────────────────────┐     ┌─────────────────────┐
│   ERROR CLEARED     │     │   ERROR DISPLAYED   │
│   (3 triggers)      │     │   (UI timeline)     │
└─────────────────────┘     └─────────────────────┘
         │                           │
         ├── 1. User submits prompt  ├── T+0: Error set
         │      → handlers.ts:83     │       → visibleError = lastError
         │      → clearError()       │       → Red border/glow
         │                           │
         ├── 2. Stop hook received   ├── T+5s: Check status
         │      → handlers.ts:263    │       → If still 'error':
         │      → clearError()       │         → setFadingOut(true)
         │                           │
         └── 3. Successful tool use  ├── T+5.5s: Fade complete
                → handlers.ts:172    │       → visibleError = null
                → clearError()       │
                                     └── If status changes:
                                            → Immediate fade out
```

### When Errors Are Set

| Trigger | Location | Condition | Error Data |
|---------|----------|-----------|------------|
| PostToolUse Hook | handlers.ts:160 | `event.success === false` | `{tool, message: event.output, timestamp}` |
| Terminal Pattern | parser.ts:35-42 | ERROR_PATTERNS match (>0.7 conf) | `{error: extractErrorMessage()}` |
| Reconciler | reconciler.ts:74-85 | Terminal error + >0.75 confidence | Status only, no lastError data |

**Note:** Only the PostToolUse hook sets `session.lastError`. Terminal-detected errors change status to `error` but don't populate the error details.

### When Errors Are Cleared

| Trigger | Location | Condition |
|---------|----------|-----------|
| User Prompt | handlers.ts:83 | User submits any input |
| Stop Hook | handlers.ts:263 | Session transitions to idle |
| Successful Tool | handlers.ts:172 | `event.success !== false` |
| Session Start | server/index.ts:873,885 | New or resumed session |

**Critical Gap:** Errors are NOT cleared when a subsequent PreToolUse arrives. This means if Claude immediately retries a failed tool, the error state persists even though work is continuing.

---

## 2. Error Types from Claude Code Hooks

### PostToolUseEvent Structure

```typescript
interface PostToolUseEvent {
  type: 'hook:post_tool_use'
  paneId: string
  sessionId: string
  toolName: string
  toolUseId: string
  success: boolean      // Key field - false triggers error
  output?: string       // Error message (when success=false)
}
```

### Observed Error Categories

Based on code analysis and common Claude Code patterns:

| Category | Tools | Behavior | Actionable? |
|----------|-------|----------|-------------|
| **Permission Denied** | Bash, Edit, Write | Tool blocked by permissions | Yes - needs user approval |
| **File Not Found** | Read, Edit | Target file doesn't exist | Maybe - Claude may create it |
| **Syntax Error** | Bash | Command has syntax errors | No - Claude will retry |
| **Process Exit Code** | Bash | Non-zero exit (tests fail, etc.) | No - Claude interprets result |
| **Rate Limit** | Any | API throttling | No - Claude waits and retries |
| **Timeout** | Bash | Long-running command killed | Maybe - depends on context |
| **Validation Error** | Write, Edit | Content doesn't match expected | No - Claude will fix |
| **Network Error** | WebFetch | Connection failed | Maybe - Claude may retry |

### ERROR_PATTERNS in Terminal Parser

| Pattern Name | Regex | Confidence | False Positive Risk |
|--------------|-------|------------|---------------------|
| error_message | `/Error:\|ERROR:\|Failed:\|FAILED:/i` | 0.8 | HIGH - Matches tool output containing "Error" |
| tool_failed | `/Tool.*failed\|Command.*failed\|Exit code [1-9]/i` | 0.85 | MEDIUM - Legitimate failures |
| rate_limit | `/rate limit\|too many requests\|quota exceeded/i` | 0.9 | LOW - Specific messages |
| permission_denied | `/permission denied\|access denied\|unauthorized/i` | 0.75 | MEDIUM - Can be in tool output |

**Issue:** High-confidence patterns like `error_message` (0.8) match text in tool output, not just actual errors. For example, `git status` showing "Error handling changes" would trigger an error state.

---

## 3. UI Error Display Behavior

### PaneCard Error Component

**Location:** `src/components/PaneCard.tsx` lines 71-122

```typescript
// Error state management
const [visibleError, setVisibleError] = useState<SessionError | null>(null)
const [fadingOut, setFadingOut] = useState(false)

useEffect(() => {
  // Case 1: No error or cleared → fade out existing
  if (!session?.lastError) {
    if (visibleError) {
      setFadingOut(true)
      setTimeout(() => setVisibleError(null), 500)
    }
    return
  }

  // Case 2: New/changed error → show immediately
  if (!visibleError || visibleError.timestamp !== session.lastError.timestamp) {
    setVisibleError(session.lastError)
    setFadingOut(false)
  }

  // Case 3: Auto-dismiss after 5s of inactivity
  setTimeout(() => {
    if (session.status === 'error' && timeSinceError >= 5000) {
      setFadingOut(true)
      setTimeout(() => setVisibleError(null), 500)
    }
  }, 5000)
}, [pane.process.claudeSession?.lastError, visibleError])
```

### Auto-Dismiss Timeline

| Time | Event | UI State |
|------|-------|----------|
| T+0 | Error set | Red border, error message shown |
| T+0-5s | Waiting | Error visible, watching for activity |
| T+5s | Check | If still `error` status, start fade |
| T+5.5s | Fade complete | Error hidden, border reset |
| Any time | Status changes | Immediate fade (500ms animation) |

**Issue:** The 5-second timeout is UI-only. The server `lastError` persists until explicitly cleared. This means:
1. UI fades error after 5s
2. User sees "Ready" or "Working" status
3. But `session.lastError` still exists in server state
4. If user refreshes, error reappears (until cleared)

### Error Display Layout

```
┌────────────────────────────────────────────────────┐
│ [Avatar] Repo Name                                 │
│          Claude Persona Name                [X][=] │
│          Activity text                      Status │
├────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────── ┐│
│ │ [Tool]: Error message truncated to 100 chars  X││
│ │ (relative timestamp: "5s ago")                 ││
│ └─────────────────────────────────────────────── ┘│
│                                                    │
│ [Terminal content...]                              │
└────────────────────────────────────────────────────┘
```

---

## 4. Expected vs Actionable Errors

### Problem Statement

The current system treats all `success=false` events equally. However, Claude Code's workflow often involves:
1. **Retries** - Claude tries something, it fails, Claude tries a different approach
2. **Validation loops** - Tests fail → Claude fixes code → tests pass
3. **Chain failures** - First step fails, Claude adapts the plan
4. **Informational failures** - `git status` returns non-zero but provides useful info

### Proposed Error Classification Scheme

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR CLASSIFICATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ACTIONABLE (Show to user, require attention)                   │
│  ───────────────────────────────────────────                    │
│  • Permission prompts blocked                                    │
│  • Rate limit with no auto-retry                                 │
│  • Fatal errors (disk full, network unreachable)                 │
│  • User-requested operation failed                               │
│                                                                 │
│  EXPECTED (Show briefly, auto-dismiss quickly)                   │
│  ─────────────────────────────────────────────                   │
│  • Test failures (Claude is analyzing results)                   │
│  • Git exit codes (normal workflow)                              │
│  • Lint errors (Claude fixing them)                              │
│  • File not found (Claude may create it)                         │
│                                                                 │
│  TRANSIENT (Don't show, log only)                                │
│  ─────────────────────────────────                               │
│  • Tool retries within 2 seconds                                 │
│  • Chain step failures (subsequent step starts)                  │
│  • Validation loop iterations                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Classification Criteria

| Factor | Actionable | Expected | Transient |
|--------|------------|----------|-----------|
| Followed by PreToolUse? | No | Maybe | Yes (<2s) |
| User prompted this tool? | Yes | Maybe | No |
| Tool is interactive? | Yes | No | No |
| Error persists 10s+? | Yes | Yes | No |
| Stop hook follows? | Yes | Maybe | N/A |

### Implementation Indicators (Not Changes)

To implement classification, the system would need to track:
1. `lastPreToolUse` timestamp - was there a retry within N seconds?
2. `toolChainDepth` - is this tool part of a chain?
3. `userInitiated` flag - did user directly request this operation?
4. Error pattern matching - is this a known "expected" error message?

---

## 5. Gap Analysis

### Gap 1: No Error Classification

**Current:** All `success=false` → error state → red UI
**Issue:** Test failures, retries, and chain events show as errors
**Impact:** Users learn to ignore error badges, reducing their utility

### Gap 2: Terminal Error Detection Mismatch

**Current:** Terminal parser detects errors via regex patterns
**Issue:** Hook-based errors and terminal-detected errors can conflict
**Example:**
1. PostToolUse hook sets error (with message details)
2. Terminal parser detects same error (no details, just status)
3. Reconciler may flip between states

### Gap 3: Error Not Cleared on PreToolUse

**Current:** Error cleared on user_prompt, stop, or successful tool
**Issue:** If Claude retries immediately, error persists through retry
**Example:**
1. Tool A fails → error state
2. Claude immediately tries Tool B (retry/workaround)
3. Error state persists during Tool B execution
4. Tool B succeeds → error cleared (finally)

### Gap 4: Reconciler Can Set Error Without Details

**Current:** Reconciler Rule 3 can set status='error' from terminal detection
**Issue:** `session.lastError` may be undefined even when status='error'
**Impact:** UI shows error badge but clicking shows "Error in undefined"

### Gap 5: Auto-Dismiss is UI-Only

**Current:** 5s timeout fades error in UI only
**Issue:** Server state retains `lastError` indefinitely
**Impact:** Error reappears on refresh; stale errors persist in logs

---

## 6. Legacy Server Comparison

The legacy server (`server/state-reconciler.ts`) had explicit error timeout handling:

```typescript
// Case 5: Hook says error but terminal shows working or idle
// Error state might be stale
if (hookState.status === 'error') {
  const errorTimestamp = hookState.lastError?.timestamp || hookState.lastActivity
  const timeSinceError = now - errorTimestamp

  if (timeSinceError > ERROR_STALE_THRESHOLD_MS) {  // 10000ms
    if (terminalState === 'working') {
      return { newStatus: 'working', reason: 'Stale error state, terminal shows working' }
    } else if (terminalState === 'idle') {
      return { newStatus: 'idle', reason: 'Stale error state, terminal shows idle' }
    }
  }
}
```

**V2 Reconciler Missing:** This timeout-based error clearing is NOT in the v2 reconciler. The v2 reconciler (Rule 3) only sets error state from terminal detection, never clears it based on time.

---

## 7. Recommendations for Phase 6 Review

### Priority 1: Error Classification

Add an `errorClass` field to distinguish:
- `'actionable'` - Show prominently, don't auto-dismiss
- `'expected'` - Show briefly (2s), then fade
- `'transient'` - Don't show, log only

### Priority 2: Clear Error on PreToolUse

If a PreToolUse event arrives while status='error', clear the error state. This handles retries and chains.

### Priority 3: Server-Side Error Timeout

Port the legacy reconciler's error staleness check to v2. Clear `lastError` after 10s if terminal shows working/idle.

### Priority 4: Lower Terminal Error Pattern Confidence

The `error_message` pattern (0.8 confidence) is too aggressive. Consider:
- Reducing confidence to 0.6
- Adding exclusion patterns for common false positives
- Requiring multiple error indicators

### Questions for Human Checkpoint

1. Should "expected" errors be shown at all, or only logged?
2. Should error classification be inferred or configurable per tool?
3. Is 5s auto-dismiss too short for actionable errors?
4. Should errors persist across session restarts?

---

## Appendix: Key File References

| Purpose | File | Key Code |
|---------|------|----------|
| Error setting | `server-v2/events/handlers.ts` | Lines 160-173 |
| Error clearing | `server-v2/sessions/manager.ts` | `clearError()` at line 184 |
| Terminal error detection | `server-v2/terminal/patterns.ts` | `ERROR_PATTERNS` |
| Reconciler error rule | `server-v2/sessions/reconciler.ts` | Rule 3, lines 74-85 |
| UI error display | `src/components/PaneCard.tsx` | Lines 71-122 |
| UI error rendering | `src/components/PaneCard.tsx` | Lines 317-337 |
| Legacy error timeout | `server/state-reconciler.ts` | Lines 224-245 |
| Types | `shared/types.ts` | `SessionError` interface, line 110-114 |
