# Phase 1: Fix Terminal Content Data Flow

## Overview

Terminal content is not displaying in the UI when accessed through Cloudflare tunnel. Investigation revealed THREE separate issues that must be fixed together:

1. **Server never captures terminal content**: `server-v2/tmux/poller.ts` polls for windows/panes but never calls `capturePane()` to get terminal content
2. **Server never broadcasts terminal content**: No `terminal_output` messages are ever sent over WebSocket
3. **Client data flow mismatch**: `usePaneTerminal` hook listens for CustomEvent on `window`, but `websocket.ts` calls `store.setTerminalContent()` directly - these mechanisms are disconnected

## Current State Analysis

```
SERVER (poller.ts)                    CLIENT (usePaneTerminal.ts)
        |                                      |
   pollTmux() runs every 250ms          usePaneTerminal(paneId)
        |                                      |
   returns TmuxPane objects               listens for CustomEvent
   WITHOUT terminalContent                 'terminal_output' on window
        |                                      |
   [NO capturePane() call]                     |
        |                                      |
   broadcasts 'windows'                        |
   [NO terminal_output broadcast]              |
                                               |
                     DISCONNECT                |
                                               |
websocket.ts receives terminal_output    usePaneTerminal never
-> calls store.setTerminalContent()      fires because no CustomEvent
   (BUT NO TERMINAL_OUTPUT SENT!)        is dispatched anywhere
```

The store has `terminalCache` and `setTerminalContent`, and there's even a selector `useTerminalContent(paneId)` that reads from it. But `usePaneTerminal` hook uses its own local cache and CustomEvents instead.

## Solution Strategy

**Simplest fix**: Make `usePaneTerminal` read from the Zustand store instead of a separate event system. The store already has the right infrastructure - it just needs to be connected.

Then add terminal capture and broadcast on the server side.

---

<plan>
  <goal>Restore terminal content visibility by fixing the three-part data pipeline: server capture, WebSocket broadcast, and client consumption.</goal>
  <context>
    The server-v2 architecture uses:
    - `server-v2/tmux/poller.ts` - polls tmux every 250ms, broadcasts `windows` message
    - `server-v2/tmux/commands.ts` - has `capturePane(paneId, lines=50)` ready to use
    - `server-v2/api/broadcast.ts` - broadcasts to WebSocket clients with backpressure
    - `server-v2/api/messages.ts` - defines `TerminalOutputMessage` type (already exists)

    The client uses:
    - `src/lib/websocket.ts` - handles `terminal_output` message, calls `store.setTerminalContent()`
    - `src/store/index.ts` - has `terminalCache: Map<string, string>` and `useTerminalContent` selector
    - `src/hooks/usePaneTerminal.ts` - IGNORES store, uses separate CustomEvent system

    The fix requires changes in all three layers but each is straightforward.
  </context>

  <task id="1">
    <name>Simplify client to use Zustand store for terminal content</name>
    <files>src/hooks/usePaneTerminal.ts, src/routes/DashboardPage.tsx</files>
    <action>
      Replace the complex CustomEvent-based usePaneTerminal hook with a simple wrapper around
      the existing Zustand store selector.

      In `src/hooks/usePaneTerminal.ts`:
      1. Remove the local Map cache (terminalContentByPane)
      2. Remove all CustomEvent listeners
      3. Remove initTerminalCache function
      4. Change usePaneTerminal to simply use the store:
         ```typescript
         import { useStore } from '../store'

         export function usePaneTerminal(paneId: string | null): string | undefined {
           return useStore((state) => paneId ? state.terminalCache.get(paneId) : undefined)
         }
         ```
      5. Export an empty initTerminalCache for backwards compatibility (or remove its call from DashboardPage)

      In `src/routes/DashboardPage.tsx`:
      1. Remove the useEffect that calls initTerminalCache() - it's no longer needed
      2. Remove the import of initTerminalCache

      This connects the existing websocket.ts handler (which calls store.setTerminalContent) to the
      usePaneTerminal hook (which will now read from the store).
    </action>
    <verify>
      1. Run `bun run build` - should complete without TypeScript errors
      2. Run `bun test` - existing tests should pass
      3. Check that usePaneTerminal.ts is under 15 lines (simple wrapper)
    </verify>
    <done>Client hook reads terminal content from Zustand store instead of CustomEvent system.</done>
  </task>

  <task id="2">
    <name>Add terminal capture and broadcast to server poller</name>
    <files>server-v2/tmux/poller.ts, server-v2/index.ts</files>
    <action>
      Modify the server to capture terminal content for Claude panes and broadcast it.

      In `server-v2/tmux/poller.ts`:
      1. Import capturePane from './commands'
      2. After building the TmuxPane objects, capture terminal content for Claude panes only
         (to avoid excessive overhead on non-Claude panes):
         ```typescript
         // After Promise.all that builds panes...

         // Capture terminal for Claude panes
         const terminalCaptures: { paneId: string; content: string }[] = []
         for (const pane of panes) {
           if (pane.process.type === 'claude') {
             try {
               const content = await capturePane(pane.id, 50)
               terminalCaptures.push({ paneId: pane.id, content })
             } catch {
               // Ignore capture failures - pane may have closed
             }
           }
         }
         ```
      3. Add terminalCaptures to the return value of TmuxState
      4. Update the TmuxState type in `server-v2/tmux/types.ts` to include:
         `terminalCaptures?: { paneId: string; content: string }[]`

      In `server-v2/index.ts`:
      1. In the startPolling callback, after broadcasting windows, broadcast terminal content:
         ```typescript
         // Broadcast terminal content for Claude panes
         if (state.terminalCaptures) {
           for (const { paneId, content } of state.terminalCaptures) {
             broadcast({
               type: 'terminal_output',
               paneId,
               content,
             })
           }
         }
         ```

      Note: terminal_output is marked as 'low' priority in messages.ts, so it will be
      dropped under backpressure - this is correct behavior.
    </action>
    <verify>
      1. Start the server: `bun run server-v2/index.ts`
      2. Open a Claude session in tmux
      3. Check server logs for "Executing tmux command" with capture-pane
      4. Monitor WebSocket messages in browser devtools - should see terminal_output messages
    </verify>
    <done>Server captures terminal content from Claude panes and broadcasts via WebSocket.</done>
  </task>

  <task id="3">
    <name>End-to-end verification and cleanup</name>
    <files>src/components/PaneCard.tsx, src/components/FullScreenPane.tsx</files>
    <action>
      Verify the complete data flow works and clean up any remaining issues.

      Manual testing steps:
      1. Build client: `bun run build`
      2. Start server: `bun run server-v2/index.ts`
      3. Open browser to http://localhost:4011
      4. Create or use existing Claude pane in tmux
      5. Verify terminal content appears in PaneCard component
      6. Click expand to verify FullScreenPane shows terminal content
      7. Test through Cloudflare tunnel to verify WebSocket path works remotely

      If terminal content still not showing:
      1. Add console.log in websocket.ts handleMessage for terminal_output
      2. Add console.log in usePaneTerminal to verify store reads
      3. Check browser devtools Network tab for WebSocket messages

      Optional cleanup:
      - Remove any dead code related to CustomEvent terminal handling
      - Consider adding a loading state while terminal content is being fetched
    </action>
    <verify>
      1. Terminal content visible in PaneCard for Claude panes
      2. Terminal content visible in FullScreenPane when expanded
      3. Content updates when Claude is working (visible activity)
      4. Works through Cloudflare tunnel (same behavior as localhost)
      5. No TypeScript errors: `bun run build`
      6. No test failures: `bun test`
    </verify>
    <done>Terminal content displays correctly in UI through the full WebSocket pipeline.</done>
  </task>
</plan>

## Risk Assessment

**Low risk changes:**
- Task 1 simplifies the client by removing complexity (CustomEvent system) in favor of existing store
- Task 2 adds well-defined server behavior using existing capturePane function

**Potential issues:**
- Performance: Capturing 50 lines from every Claude pane every 250ms could be expensive if many panes
  - Mitigation: Only capture Claude panes (not all panes)
  - Future: Add adaptive capture interval based on activity
- Backpressure: terminal_output is low priority, may be dropped
  - This is acceptable - terminal content is nice-to-have, not critical
  - The next poll cycle will send updated content

## Commit Message Template

```
fix: restore terminal content display in UI

- Simplify usePaneTerminal hook to read from Zustand store
- Add terminal capture to server poller for Claude panes
- Broadcast terminal_output messages over WebSocket

Fixes data flow disconnect where websocket.ts updated store
but usePaneTerminal used separate CustomEvent system.
```
