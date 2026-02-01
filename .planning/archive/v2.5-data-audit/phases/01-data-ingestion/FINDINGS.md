# Phase 1: Data Ingestion Audit - Findings

**Audit Date:** 2026-01-31
**Phase Status:** Completed

## Executive Summary

The data ingestion system has two primary entry points:
1. **Tmux Polling** - Active polling every 250ms to discover/track panes
2. **HTTP Hook Events** - Claude Code hooks POST events to `/event`

These systems are designed to work together but have potential race conditions and timing issues that could explain the "ready while active" bug.

---

## 1. Tmux Polling Mechanism

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/poller.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/process.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/commands.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/session-builder.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/lib/config.ts`

### Polling Frequency

| Configuration | Default Value | Source |
|---------------|---------------|--------|
| `POLL_INTERVAL` | 250ms | `lib/config.ts` line 34 |

### Terminal Capture Intervals (Adaptive)

The system uses adaptive capture intervals based on pane activity:

| State | Interval | Condition |
|-------|----------|-----------|
| `CAPTURE_INTERVAL_ACTIVE_MS` | 250ms | Content changed within 2s |
| `CAPTURE_INTERVAL_NORMAL_MS` | 500ms | Claude pane working/waiting |
| `CAPTURE_INTERVAL_IDLE_MS` | 2000ms | Non-Claude or stable |
| `CAPTURE_INTERVAL_BACKOFF_MS` | 5000ms | 5+ consecutive no-changes |

### Fields Extracted from Tmux

**From `list-windows` command:**
```
#{window_id}:#{session_name}:#{window_index}:#{window_name}:#{window_active}
```

| Field | Maps To |
|-------|---------|
| `window_id` | `TmuxWindow.id` |
| `session_name` | `TmuxWindow.sessionName` |
| `window_index` | `TmuxWindow.windowIndex` |
| `window_name` | `TmuxWindow.windowName` |
| `window_active` | Not used by client |

**From `list-panes` command:**
```
#{pane_id}:#{window_id}:#{pane_index}:#{pane_active}:#{pane_width}:#{pane_height}:#{pane_pid}:#{pane_current_command}
```

| Field | Maps To |
|-------|---------|
| `pane_id` | `TmuxPane.id` |
| `window_id` | Internal grouping (removed before client) |
| `pane_index` | `TmuxPane.index` |
| `pane_active` | `TmuxPane.active` |
| `pane_width` | `TmuxPane.width` |
| `pane_height` | `TmuxPane.height` |
| `pane_pid` | `TmuxPane.process.pid` |
| `pane_current_command` | `TmuxPane.process.command` |

### Process Detection Flow

```
pane_pid
    |
    v
getProcessInfo(pid)  ─────> Read /proc/{pid}/cmdline
    |
    v
isClaudeProcess(info)
    |
    ├─ TRUE ─> return 'claude'
    │
    └─ Check if shell ─> getChildPids(pid)
                              |
                              v
                         For each child:
                              isClaudeProcess(childInfo)
                              |
                              ├─ TRUE ─> return 'claude'
                              └─ FALSE ─> return 'shell'
```

**Claude detection patterns (`isClaudeProcess`):**
- Command contains `claude` or `claude-code`
- Node/Bun running with `claude` or `@anthropic` in args

### Terminal Capture

For Claude panes only:
- Uses `tmux capture-pane -p -e -S -100 -E -1`
- Captures last 100 lines with ANSI escape sequences
- Content stored in `TmuxPane.terminalContent`

### Pane Cleanup

When panes are removed (detected by comparing pane IDs across polls):
1. `removeSession(paneId)` - Clears session from memory
2. `terminalHashes.delete(paneId)` - Removes hash tracking
3. `cleanupPaneTracking(paneId)` - Clears adaptive polling state
4. Broadcasts `pane_removed` to clients

---

## 2. Hook Event Processing

### Files Analyzed
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/hooks.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/bus.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/types.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/handlers.ts`

### HTTP Endpoint

**Route:** `POST /event`
**Handler:** `handleEvent()` in `api/handlers.ts`

### Hook Event Types Processed

| Event Type | Internal Event | Status Change |
|------------|----------------|---------------|
| `pre_tool_use` | `hook:pre_tool_use` | Sets status to `working` |
| `post_tool_use` | `hook:post_tool_use` | Error: `error`, Success: clears error |
| `stop` | `hook:stop` | Sets status to `idle` |
| `user_prompt_submit` / `user_prompt` | `hook:user_prompt` | Sets status to `typing` |
| `notification` | `hook:notification` | No status change |

### Payload Normalization

The system handles both snake_case and camelCase field names:

| Normalized Field | Raw Variants |
|------------------|--------------|
| `sessionId` | `session_id`, `sessionId` |
| `paneId` | `pane_id`, `paneId`, `tmux_target`, `tmuxTarget` |
| `toolName` | `tool_name`, `toolName` |
| `toolUseId` | `tool_use_id`, `toolUseId` |

### Event Deduplication

- **TTL:** 5 minutes
- **Max events:** 1000
- **Key format:** `{eventType}:{sessionId}:{toolUseId}`
- Cleanup happens when cache exceeds max size

### Pane ID Correlation

**Critical:** Hooks use `paneId` (or `tmux_target`) to correlate with polled panes.

```typescript
// In hooks.ts normalizePayload():
paneId: raw.pane_id || raw.paneId || raw.tmux_target || raw.tmuxTarget || ''
```

If paneId is empty, the event is logged as warning and ignored.

---

## 3. Event Routing (Event Bus)

### Architecture

```
processHookEvent()
       |
       v
eventBus.emit<EventType>()
       |
       v
handlers registered via eventBus.on()
       |
       ├── Event handler in handlers.ts
       │        |
       │        v
       │   updateFromHook() / session manager
       │
       └── Wildcard handler in index.ts (broadcast all events)
```

### Handler Priority

Handlers sorted by priority (higher runs first, default 0).
Currently no explicit priorities set - all handlers run at priority 0.

### Event Handler Actions

| Event | Handler Actions |
|-------|-----------------|
| `hook:pre_tool_use` | Create persona, link to session, set status to `working` |
| `hook:user_prompt` | Create persona, set status to `typing`, clear errors, update health |
| `hook:post_tool_use` | XP calculation, stat tracking, error state management |
| `hook:stop` | Set status to `idle`, clear errors, update companion stats |
| `session:status_changed` | Discord notifications |

---

## 4. Data Flow Diagram

```
                    ┌──────────────────────────────────────────────────────┐
                    │                    ENTRY POINTS                       │
                    └──────────────────────────────────────────────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               │                               ▼
┌─────────────────────┐                   │                  ┌─────────────────────┐
│   TMUX POLLING      │                   │                  │   CLAUDE HOOKS      │
│   (250ms interval)  │                   │                  │   (HTTP POST)       │
├─────────────────────┤                   │                  ├─────────────────────┤
│ tmux list-windows   │                   │                  │ POST /event         │
│ tmux list-panes     │                   │                  │ {event_type, ...}   │
│ tmux capture-pane   │                   │                  │                     │
│ /proc/{pid}/cmdline │                   │                  │                     │
└─────────────────────┘                   │                  └─────────────────────┘
          │                               │                               │
          ▼                               │                               ▼
┌─────────────────────┐                   │                  ┌─────────────────────┐
│ PROCESS DETECTION   │                   │                  │ NORMALIZE PAYLOAD   │
│ classifyProcess()   │                   │                  │ normalizePayload()  │
├─────────────────────┤                   │                  ├─────────────────────┤
│ claude | shell |    │                   │                  │ snake_case →        │
│ process | idle      │                   │                  │ camelCase           │
└─────────────────────┘                   │                  └─────────────────────┘
          │                               │                               │
          │                               │                               ▼
          │                               │                  ┌─────────────────────┐
          │                               │                  │ EVENT DEDUP         │
          │                               │                  │ seenEvents Map      │
          │                               │                  └─────────────────────┘
          │                               │                               │
          ▼                               │                               ▼
┌─────────────────────┐                   │                  ┌─────────────────────┐
│ BUILD SESSION INFO  │◄──────────────────┼──────────────────│ EVENT BUS           │
│ buildClaudeSession- │                   │                  │ eventBus.emit()     │
│ Info()              │                   │                  └─────────────────────┘
└─────────────────────┘                   │                               │
          │                               │                               ▼
          │                               │                  ┌─────────────────────┐
          │                               │                  │ EVENT HANDLERS      │
          │                               │                  │ initEventHandlers() │
          │                               │                  ├─────────────────────┤
          │                               │                  │ • Create persona    │
          │                               │                  │ • XP calculation    │
          │                               │                  │ • Stat tracking     │
          │                               │                  │ • Status updates    │
          │                               │                  └─────────────────────┘
          │                               │                               │
          │                               │                               │
          │                               │                               ▼
          │                               │                  ┌─────────────────────┐
          │                               │                  │ SESSION MANAGER     │
          │                               │                  │ updateFromHook()    │
          │                               │                  └─────────────────────┘
          │                               │                               │
          │                               │                               │
          └───────────────────────────────┼───────────────────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │   SESSION STATE       │
                              │   (In-Memory Map)     │
                              ├───────────────────────┤
                              │ sessions.get(paneId)  │
                              │   .status             │
                              │   .statusSource       │
                              │   .statusChangedAt    │
                              │   .personaId          │
                              │   .projectId          │
                              │   .terminalContent    │
                              │   .lastError          │
                              └───────────────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐      ┌─────────────────────┐
│ TERMINAL PARSING    │     │ STATE RECONCILER    │      │ WEBSOCKET BROADCAST │
│ parseTerminal()     │────▶│ reconcile()         │      │ broadcast()         │
├─────────────────────┤     ├─────────────────────┤      ├─────────────────────┤
│ Match patterns:     │     │ Hook vs Terminal    │      │ windows, companions │
│ • WAITING_PATTERNS  │     │ • Rule-based        │      │ terminal_output     │
│ • WORKING_PATTERNS  │     │ • Timeout-based     │      │ pane_update         │
│ • IDLE_PATTERNS     │     │ • Confidence scores │      │ pane_removed        │
│ • ERROR_PATTERNS    │     │                     │      │ event (all events)  │
└─────────────────────┘     └─────────────────────┘      └─────────────────────┘
```

---

## 5. Potential Issues Identified

### Issue 1: Race Condition Between Poll and Hook

**Severity:** High
**Related Bug:** "Ready while active" state mismatch

**Description:**
The 250ms polling interval and async hook processing can result in stale data:

1. Hook sets status to `working`
2. Poll captures terminal content
3. `updateFromTerminal()` calls reconciler
4. Reconciler may override `working` to `idle` if terminal content appears idle

**Evidence:**
- `index.ts` line 103: Poll callback calls `updateFromTerminal()` which can change status
- No locking mechanism between hook updates and terminal updates
- Reconciler can override hook status (see Rule 4 and Rule 5 in reconciler)

### Issue 2: Terminal Content Staleness

**Severity:** Medium

**Description:**
Cached terminal content (`lastTerminalContent` in poller.ts) may be stale when:
- Adaptive polling backs off (5s interval)
- Hash comparison misses visual changes that don't affect content

**Evidence:**
- `poller.ts` lines 237-240: Returns cached content when skipping capture
- Hash is simple djb2-style, may have collisions

### Issue 3: Session Creation Race

**Severity:** Medium

**Description:**
Session can be created from two paths simultaneously:
1. `buildClaudeSessionInfo()` in poller (tmux detection)
2. `getOrCreatePersona()` in hook handlers

Both call `getOrCreateSession()` but persona linking happens separately.

**Evidence:**
- `session-builder.ts` line 51: Creates session from poll
- `handlers.ts` line 46-48, 74-77, 111-115: Also links persona in multiple handlers

### Issue 4: Reconciler Timeout Values

**Severity:** Low

**Description:**
Timeout values may be too short for slower systems:
- `IDLE_TIMEOUT_MS = 3000` (3 seconds)
- `UNKNOWN_TIMEOUT_MS = 5000` (5 seconds)

A slow tool execution could be incorrectly marked as `idle`.

**Evidence:**
- `reconciler.ts` lines 14-15
- Rule 4 (line 87-99): Sets idle after 3s of terminal idle
- Rule 5 (line 102-113): Sets idle after 5s of unknown

### Issue 5: Missing Hook Events

**Severity:** Low

**Description:**
Some hook event types mentioned in CLAUDE.md are not fully handled:
- `subagent_stop` - Not in processHookEvent switch statement
- `session_start` - Not in processHookEvent switch statement
- `session_end` - Not in processHookEvent switch statement

**Evidence:**
- `hooks.ts` lines 137-189: Switch statement only handles 5 event types
- Default case just logs "Unknown event type"

---

## 6. Recommendations for Phase 2

1. **Audit the reconciler logic** - Understand when/why terminal detection overrides hooks
2. **Trace the "working" → "idle" transition** - Identify all code paths
3. **Review timeout values** - Consider making them configurable
4. **Add instrumentation** - Log state transitions with timestamps for debugging

---

## Appendix: Key File References

| Purpose | File | Key Functions |
|---------|------|---------------|
| Polling entry | `server-v2/index.ts` | `startPolling()` callback (line 83) |
| Tmux poller | `server-v2/tmux/poller.ts` | `pollTmux()`, `startPolling()` |
| Process detection | `server-v2/tmux/process.ts` | `classifyProcess()`, `isClaudeProcess()` |
| Session builder | `server-v2/tmux/session-builder.ts` | `buildClaudeSessionInfo()` |
| Hook processing | `server-v2/events/hooks.ts` | `processHookEvent()` |
| Event handlers | `server-v2/events/handlers.ts` | `initEventHandlers()` |
| Session manager | `server-v2/sessions/manager.ts` | `updateFromHook()`, `updateFromTerminal()` |
| Reconciler | `server-v2/sessions/reconciler.ts` | `reconcile()` |
| Terminal parser | `server-v2/terminal/parser.ts` | `parseTerminal()` |
| Config | `server-v2/lib/config.ts` | `loadConfig()` |
