# Phase 5: WebSocket and UI Display Audit - Findings

**Audit Date:** 2026-01-31
**Phase Status:** Completed

## Executive Summary

The WebSocket broadcast system has well-defined priority levels and backpressure handling. However, the data flow from server to UI has several characteristics that can cause stale data display and state mismatches. The "ready while active" bug manifests in the UI because:

1. **Full state broadcasts every 250ms** override pane updates, including status
2. **No atomic updates** - session status changes in the server-side reconciler (Phase 2 finding) propagate through periodic broadcasts rather than targeted `pane_update` messages
3. **Backpressure can drop critical updates** - `terminal_output` is high priority but `event` is low priority, meaning XP and activity events can be lost under load

---

## 1. Server-Side WebSocket Architecture

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/ws.ts` - Connection handlers
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/broadcast.ts` - Broadcast with backpressure
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/messages.ts` - Message types and priorities
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/heartbeat.ts` - Keepalive mechanism
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/index.ts` - Main broadcast logic

### Connection Lifecycle

```
Client connects via /ws
    |
    v
wsHandlers.open() - server-v2/api/ws.ts:28
    - Generate sessionId (UUID)
    - Set connectedAt, lastPong
    - Add to clients Set
    - Send 'connected' message
    - Send initial 'companions' (all projects)
    - Send initial 'quests_init' (active quests)
    |
    v
[Connection active - receives broadcasts]
    |
    v
wsHandlers.pong() - Update lastPong timestamp
    |
    v
startHeartbeat() - Every 30s:
    - Send ping to all clients
    - Close stale connections (>60s since last pong)
    |
    v
wsHandlers.close() - Remove from clients Set
```

### Message Priority System

| Priority | Message Types | Behavior Under Backpressure |
|----------|---------------|----------------------------|
| **high** | `pane_update`, `pane_removed`, `terminal_output`, `error` | Always sent |
| **normal** | `connected`, `windows`, `personas`, `persona_update`, `projects`, `project_update`, `quests_init`, `quest_update`, `companions`, `companion_update`, `xp_gain` | Paused when buffer >64KB |
| **low** | `event`, `moltbook_activity`, `moltbook_health` | Dropped when buffer >64KB |

**Critical Note:** `terminal_output` is HIGH priority (server-v2/api/messages.ts:157), which contradicts the CLAUDE.md documentation stating it's LOW priority. The server code is the source of truth.

### Backpressure Implementation

```typescript
// server-v2/api/broadcast.ts:12-13
const BUFFER_HIGH = 64 * 1024  // 64KB - pause threshold
const BUFFER_LOW = 16 * 1024   // 16KB - resume threshold
```

**Behavior:**
1. When `client.bufferedAmount > 64KB`: Add to `pausedClients` Set
2. When `client.bufferedAmount < 16KB`: Remove from `pausedClients` Set
3. HIGH priority messages: Always sent to all clients
4. NORMAL/LOW priority: Skipped for paused clients

**Issue:** The `drain` handler (wsHandlers.drain) removes clients from `pausedClients`, but this only fires when the buffer completely drains. Between 16KB and drain, there's a window where normal-priority messages might still be skipped.

---

## 2. Broadcast Patterns in Main Loop

### Polling Loop Broadcasts (server-v2/index.ts:83-148)

Every 250ms (configurable), the polling callback:

1. **Broadcasts `windows`** (NORMAL priority)
   - Complete state of all windows and panes
   - Includes claudeSession with status, lastError, etc.

2. **Broadcasts `companions`** (NORMAL priority)
   - Complete state of all projects with XP/stats

3. **For each Claude pane with terminal content:**
   - Calls `updateFromTerminal()` (can change session status)
   - If content hash changed: broadcasts `terminal_output` (HIGH priority)

4. **For removed panes:**
   - Broadcasts `pane_removed` (HIGH priority)

### Event-Driven Broadcasts

| Trigger | Message | Priority | Location |
|---------|---------|----------|----------|
| Any hook event | `event` | LOW | index.ts:55 |
| Quest update | `quest_update` | NORMAL | quests/service.ts:23 |
| Terminal refresh | `terminal_output` | HIGH | api/handlers.ts:243 |
| Moltbook activity | `moltbook_activity` | LOW | moltbook/watcher.ts:139 |
| Moltbook health | `moltbook_health` | LOW | moltbook/watcher.ts:151 |

### Missing Targeted Updates

**Finding:** The server does NOT broadcast `pane_update` when session status changes. Instead, status changes are embedded in the next `windows` broadcast.

```
Hook Event (e.g., PreToolUse)
    |
    v
eventBus.emit('hook:pre_tool_use')
    |
    v
handlers.ts: updateFromHook(paneId, 'working')
    - Updates session.status in memory
    |
    v
broadcast({ type: 'event', ... })  <-- LOW priority, may be dropped
    |
    v
[No pane_update broadcast!]
    |
    v
Next poll cycle (up to 250ms later)
    |
    v
broadcast({ type: 'windows', ... })  <-- Status change finally propagated
```

**Impact:** Status changes can be delayed up to 250ms. If the client is under backpressure and `windows` is skipped, the delay compounds.

---

## 3. Client-Side WebSocket Handling

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/lib/websocket.ts` - WebSocket client
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/store/index.ts` - Zustand store

### Message Flow

```
WebSocket message received
    |
    v
handleMessage() - src/lib/websocket.ts:99
    |
    +-- case 'windows':
    |      - Check waiting transitions for toasts
    |      - store.setWindows(payload)
    |
    +-- case 'pane_update':
    |      - Check waiting transitions for toasts
    |      - store.updatePane(payload)
    |
    +-- case 'pane_removed':
    |      - Clean up paneStatuses Map
    |      - store.removePane(paneId)
    |
    +-- case 'terminal_output':
    |      - store.setTerminalContent(paneId, content)
    |
    +-- case 'companions':
    |      - store.setCompanions(payload)
    |
    +-- case 'event':
    |      - store.addEvent(event)
    |      - store.recordPaneActivity(paneId, activityType)
    |
    +-- case 'xp_gain':
    |      - store.addXPGain(payload)
    |
    +-- case 'achievement_unlocked':
    |      - store.addToast(...)
    |      - playSoundIfEnabled('achievement')
    |
    +-- case 'pane_error':
           - store.addToast(...)
           - playSoundIfEnabled('error')
```

### Waiting Status Transition Detection

The client tracks previous status per pane to detect transitions:

```typescript
// src/lib/websocket.ts:41
const paneStatuses = new Map<string, string>()

// On status change to 'waiting':
if (newStatus === 'waiting' && oldStatus !== 'waiting') {
  store.addToast({ type: 'waiting', ... })
  playSoundIfEnabled('waiting')
}
```

**Issue:** This detection happens on BOTH `windows` and `pane_update` messages. If the server sends `windows` every 250ms, the client re-checks all panes each time, but only fires the toast if the Map value differs.

### Reconnection Logic

| Scenario | Action |
|----------|--------|
| Connection closed | Exponential backoff: 1s, 2s, 4s, ... 30s max |
| Tab becomes visible | Clear backoff, immediate reconnect |
| Network comes online | Clear backoff, immediate reconnect |
| Sleep detected | Reset backoff counter, immediate reconnect |
| Backend switch event | 500ms delay, then reconnect |

**Sleep Detection:**
```typescript
const SLEEP_DETECTION_THRESHOLD = 5000
// If actual elapsed time >> scheduled reconnect time, device slept
if (elapsed > scheduledReconnectTime + SLEEP_DETECTION_THRESHOLD) {
  reconnectAttemptCount = 0  // Reset backoff
}
```

---

## 4. Zustand Store Structure

### State Slices

| Slice | Source | Update Pattern |
|-------|--------|----------------|
| `windows` | `windows` message | Full replacement every 250ms |
| `terminalCache` | `terminal_output` message | Incremental (Map.set) |
| `paneActivity` | `event` message | Incremental (object spread) |
| `companions` | `companions` message | Full replacement every 250ms |
| `quests` | `quests_init`, `quest_update` | Init once, then incremental |
| `recentEvents` | `event`, `history` messages | Prepend, capped at 100 |
| `recentXPGains` | `xp_gain` message | Prepend, capped at 50 |
| `toasts` | Various messages | Append, capped at 5 |
| `status` | Internal | Set on connect/disconnect |

### setWindows Implementation

```typescript
// src/store/index.ts:202-213
setWindows: (windows) => set((state) => {
  // Also populate terminalCache from panes that have terminalContent
  const terminalCache = new Map(state.terminalCache)
  for (const window of windows) {
    for (const pane of window.panes) {
      if (pane.terminalContent) {
        terminalCache.set(pane.id, pane.terminalContent)
      }
    }
  }
  return { windows, terminalCache }
})
```

**Issue:** Every 250ms, the entire `windows` array is replaced. This triggers React re-renders for all components subscribed to `windows`. The `terminalCache` is also rebuilt from scratch.

### Selector Deprecation Warning

```typescript
// WARNING: Selectors that return new arrays/objects cause infinite loops with
// React 18's useSyncExternalStore. Instead of using these deprecated selectors,
// get `windows` from the store and derive values with useMemo in your component
```

The store explicitly warns against array-returning selectors. Components should use `useMemo` to derive filtered arrays.

---

## 5. UI Rendering Flow

### PaneCard Status Display

```
store.windows update
    |
    v
OverviewDashboard (memoized)
    - Derives windowGroups with useMemo([windows])
    |
    v
WindowSection (memoized)
    - Renders each pane
    |
    v
PaneCard (memoized with custom comparator)
    - paneEqual() checks: status, name, avatar, currentTool, currentFile,
      lastPrompt, pendingQuestion, terminalPrompt, lastError, stats,
      activeSubagents, repo details
    |
    v
getPaneStatus(pane)
    - Returns session.status for Claude panes
    - Returns 'typing' if pane.process.typing
    - Returns pane.process.type otherwise
    |
    v
StatusIndicator (memoized)
    - Maps status to theme (STATUS_THEME)
    - Renders badge with appropriate styling
```

### Memoization Strategy

| Component | Memo Type | Comparison |
|-----------|-----------|------------|
| OverviewDashboard | memo() | Shallow |
| WindowSection | memo() | Shallow |
| PaneCard | memo(fn, paneEqual) | Custom deep comparison |
| StatusIndicator | memo() | Shallow |

The `paneEqual` function (src/utils/pane-status.ts:13-45) performs deep comparison of fields that affect rendering:
- `process.type`, `typing`, `command`
- `claudeSession.status`, `name`, `avatarSvg`, `currentTool`, `currentFile`, `lastPrompt`
- `pendingQuestion.toolUseId`, `terminalPrompt.contentHash`
- `lastError.timestamp`, `stats.totalXPGained`
- `activeSubagents` (joined IDs)
- `repo` details

### Error Display Lifecycle

```
session.lastError set (server)
    |
    v
windows broadcast includes lastError
    |
    v
PaneCard useEffect detects lastError change
    - Set visibleError
    - Set fadingOut = false
    |
    v
After 5s timeout:
    - If status still 'error': setFadingOut(true)
    - After 500ms: setVisibleError(null)
    |
    v
If lastError cleared (server):
    - setFadingOut(true)
    - After 500ms: setVisibleError(null)
```

**Issue:** The 5s auto-dismiss is UI-only. Server `lastError` persists indefinitely (Phase 3 finding). If user refreshes, error reappears.

---

## 6. End-to-End Latency Analysis

### Best Case (No Backpressure)

| Event | Latency | Cumulative |
|-------|---------|------------|
| Hook event received | 0ms | 0ms |
| Status updated in memory | <1ms | 1ms |
| Next poll cycle | 0-250ms | 1-251ms |
| `windows` broadcast | <1ms | 2-252ms |
| WebSocket send | <10ms | 12-262ms |
| Client message handler | <1ms | 13-263ms |
| Store update | <1ms | 14-264ms |
| React re-render | <16ms | 30-280ms |

**Total: 30-280ms** (average ~155ms)

### Worst Case (Backpressure Active)

| Event | Latency | Cumulative |
|-------|---------|------------|
| Hook event received | 0ms | 0ms |
| Status updated in memory | <1ms | 1ms |
| Next poll cycle | 0-250ms | 1-251ms |
| `windows` broadcast skipped (normal priority) | - | - |
| Next poll cycle | 250ms | 251-501ms |
| `windows` broadcast skipped again | - | - |
| Buffer drains, resumes | 0-5000ms | 251-5501ms |
| WebSocket send | <10ms | 261-5511ms |
| Client message handler | <1ms | 262-5512ms |

**Total: Up to 5.5 seconds** under heavy backpressure

### "Ready While Active" UI Manifestation

Combining Phase 2 findings with this audit:

```
T+0ms:      PreToolUse hook -> status='working'
T+1ms:      `event` broadcast (LOW priority)
            [If backpressure: DROPPED]

T+250ms:    Polling -> `windows` broadcast (NORMAL priority)
            [If backpressure: SKIPPED]
            UI still shows previous status

T+500ms:    Polling -> `windows` broadcast (NORMAL priority)
            [If backpressure: SKIPPED]

T+3000ms:   Reconciler Rule 4 triggers (IDLE_TIMEOUT_MS)
            -> status='idle' (PREMATURE!)

T+3250ms:   Polling -> `windows` broadcast
            UI shows "Ready" even though Claude is working

T+5000ms:   Stop hook arrives (finally)
            status='idle' (no change, already idle)
```

---

## 7. Staleness Risks

### Risk 1: Full State Broadcast Masks Individual Updates

**Severity:** MEDIUM

The server broadcasts complete `windows` state every 250ms. If a targeted `pane_update` is sent, the next `windows` message overwrites it.

**Scenario:**
1. Pane status changes to 'waiting'
2. `pane_update` broadcast (HIGH priority, delivered)
3. User sees 'Waiting' badge
4. 100ms later, reconciler overrides to 'idle' (Phase 2 bug)
5. `windows` broadcast includes 'idle' status
6. UI flickers to 'Ready'

### Risk 2: Event Messages Are Low Priority

**Severity:** LOW-MEDIUM

The `event` message type is LOW priority, meaning activity indicators (`recordPaneActivity`) can be lost under backpressure. This affects the visual pulse animation in PaneAvatar.

### Risk 3: Terminal Output and Windows Race

**Severity:** LOW

Both `terminal_output` (HIGH) and `windows` (NORMAL) can carry terminal content. If `windows` arrives before `terminal_output`, the terminalCache is updated twice with potentially different content.

```typescript
// setWindows extracts terminalContent
for (const pane of window.panes) {
  if (pane.terminalContent) {
    terminalCache.set(pane.id, pane.terminalContent)
  }
}
```

### Risk 4: Reconnection State Loss

**Severity:** LOW

On reconnection, the client receives fresh `companions`, `quests_init`, and first `windows` message. Any in-flight status changes during reconnection are lost.

---

## 8. How Known Bugs Manifest in UI

### Bug 1: "Ready While Active"

**Root Cause (Phase 2):** Reconciler Rules 4/5 override hook status after 3-5 second timeouts based on terminal pattern matching.

**UI Manifestation:**
1. PaneCard receives `windows` with `session.status = 'idle'`
2. `getPaneStatus(pane)` returns `'idle'`
3. `StatusIndicator` renders with `STATUS_THEME.idle` (green "Ready" badge)
4. No visual indicator that Claude is still working
5. User assumes task is complete

**Missing Feedback:**
- No terminal activity indicator (pulse animation) if `event` message was dropped
- No "Working" badge or glow

### Bug 2: False Error Display

**Root Cause (Phase 3):** No error classification - all `success=false` events are treated equally.

**UI Manifestation:**
1. PaneCard receives `windows` with `session.lastError` set
2. `visibleError` state is set immediately
3. Red border and error message appear
4. User sees error badge for a recoverable/expected error
5. After 5s, UI fades out error (but server still has `lastError`)
6. If page refreshes before `lastError` is cleared, error reappears

### Bug 3: Status Flicker

**Root Cause:** Multiple update sources (hook events, reconciler, polling) can conflict.

**UI Manifestation:**
1. Status changes rapidly: working -> waiting -> working -> idle
2. Each change triggers React re-render
3. StatusIndicator badge flickers between colors
4. User sees brief "Waiting" badge before it disappears

---

## 9. Recommendations for Phase 6 Review

### Priority 1: Add Targeted pane_update Broadcasts

When session status changes (in handlers.ts or reconciler), broadcast a targeted `pane_update` message instead of waiting for the next `windows` broadcast. This reduces latency from 0-250ms to <10ms.

### Priority 2: Increase Message Priorities

Consider promoting `event` from LOW to NORMAL priority. Activity tracking is important for user feedback (pulse animations).

### Priority 3: Reduce Full State Broadcast Frequency

The 250ms polling interval causes 4 full state broadcasts per second. Consider:
- Increase to 500ms (reduce bandwidth by 50%)
- Only broadcast `windows` when state actually changes (hash comparison)
- Send delta updates instead of full state

### Priority 4: Add Status Change Timestamps

Include a `statusChangedAt` timestamp in `ClaudeSessionInfo`. The UI can use this to:
- Detect stale status (>5s since change)
- Show "last updated X seconds ago" indicator
- Distinguish between "just became ready" and "been ready for a while"

### Priority 5: Implement Client-Side Staleness Detection

The client could track the last time status was updated and show a visual indicator when status is potentially stale:

```typescript
const statusAge = Date.now() - (session.statusChangedAt || 0)
if (statusAge > 10000 && session.status === 'idle') {
  // Show "Status may be stale" indicator
}
```

---

## Appendix: Key File References

| Purpose | File | Key Code |
|---------|------|----------|
| WS handlers | `server-v2/api/ws.ts` | `wsHandlers` object |
| Broadcast logic | `server-v2/api/broadcast.ts` | `broadcast()`, `shouldSendToClient()` |
| Message priorities | `server-v2/api/messages.ts` | `getPriority()` |
| Heartbeat | `server-v2/api/heartbeat.ts` | `startHeartbeat()` |
| Main polling loop | `server-v2/index.ts` | Lines 83-148 |
| Client WS | `src/lib/websocket.ts` | `handleMessage()`, `connect()` |
| Zustand store | `src/store/index.ts` | `setWindows()`, slices |
| PaneCard | `src/components/PaneCard.tsx` | Error effect (71-122), status display |
| StatusIndicator | `src/components/StatusIndicator.tsx` | Badge rendering |
| Status utils | `src/utils/pane-status.ts` | `getPaneStatus()`, `paneEqual()` |
| Status constants | `src/constants/status.ts` | `STATUS_THEME`, `STATUS_LABELS` |
| Shared types | `shared/types.ts` | `ServerMessage`, `SessionStatus` |
