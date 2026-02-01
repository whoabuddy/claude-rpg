# Phase 2: Fix Personas Status Detection

## Problem
All personas show "offline" status on the Personas tab even though they are active Claude instances.

## Root Cause
The session manager has `updateFromHook()` and `updateFromTerminal()` functions to update session status, but these are never being called. Hook events are processed in `events/handlers.ts` which updates XP/health/challenges, but never updates the session status that gets displayed in the UI.

## Solution
Wire up session status updates in the event handlers so that:
- `pre_tool_use` → sets status to 'working'
- `stop` → sets status to 'idle'
- Terminal parsing → reconciles status based on prompts/spinners

## Tasks

### Task 1: Add session status updates to hook event handlers
**File:** `server-v2/events/handlers.ts`

**Action:**
1. Import `updateFromHook` from `../sessions/manager`
2. Add status update to `hook:pre_tool_use` handler → call `updateFromHook(event.paneId, 'working')`
3. Add status update to `hook:stop` handler → call `updateFromHook(event.paneId, 'idle')`
4. Add status update to `hook:user_prompt` handler → call `updateFromHook(event.paneId, 'typing')`

**Verify:**
```bash
# Check that imports and calls are correct
grep -A 5 "updateFromHook" server-v2/events/handlers.ts
```

### Task 2: Wire terminal content updates to session manager
**File:** `server-v2/index.ts` (main server)

**Action:**
1. Import `updateFromTerminal` from `./sessions/manager`
2. In the tmux poller callback (around line 93), add terminal content updates
3. Call `updateFromTerminal(pane.id, pane.terminalContent)` for each Claude pane

**Verify:**
```bash
# Check terminal updates are wired
grep -A 3 "updateFromTerminal" server-v2/index.ts
```

### Task 3: Test status detection
**Action:**
1. Start server: `bun run server-v2/index.ts`
2. Open client in browser
3. Trigger a tool use in Claude
4. Verify status changes from idle → working → idle
5. Check PersonasPage shows correct status

**Verify:**
- Manual testing in browser
- Check server logs for status transitions

## Files Changed
- `server-v2/events/handlers.ts` - Add session status updates
- `server-v2/index.ts` - Wire terminal content to session manager

## Expected Outcome
Personas will show correct status ('working', 'idle', 'waiting', 'typing') instead of all showing as offline.
