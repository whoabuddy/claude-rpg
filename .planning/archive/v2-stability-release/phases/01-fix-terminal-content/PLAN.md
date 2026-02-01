# Phase 1: Fix Terminal Content Data Flow

## Goal
Restore terminal content visibility by fixing the broken data pipeline from server to UI.

## Context
Three disconnected issues prevent terminal content from displaying:
1. Server-v2 `poller.ts` never calls `capturePane()` to get terminal content
2. Server-v2 never broadcasts `terminal_output` WebSocket messages
3. Client `usePaneTerminal` hook listens for CustomEvents, but `websocket.ts` updates Zustand store directly

The Zustand store already has the right infrastructure (`terminalCache`, `setTerminalContent`). We just need to:
- Make the server send terminal content
- Make the client read from the store instead of CustomEvents

<plan>
  <goal>Fix terminal content data flow from server capture to client display</goal>
  <context>
    - Server has capturePane() in commands.ts but never uses it
    - WebSocket handler already calls store.setTerminalContent() on terminal_output
    - usePaneTerminal hook uses CustomEvents instead of store - this is the disconnect
    - Store has terminalCache Map ready to use
  </context>

  <task id="1">
    <name>Update usePaneTerminal hook to use Zustand store</name>
    <files>src/hooks/usePaneTerminal.ts</files>
    <action>
      1. Remove CustomEvent listener pattern entirely
      2. Replace with Zustand store selector: `useStore(state => state.terminalCache.get(paneId))`
      3. Keep the hook signature the same: `usePaneTerminal(paneId: string | null): string | undefined`
      4. Remove the module-level cache (terminalContentByPane Map) - store handles this
      5. Remove initTerminalCache() export - no longer needed
    </action>
    <verify>
      - Build passes: `cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun run build`
      - No TypeScript errors
      - Hook still returns string | undefined
    </verify>
    <done>Hook reads from Zustand store instead of CustomEvents</done>
  </task>

  <task id="2">
    <name>Add terminal capture and broadcast to server polling</name>
    <files>server-v2/tmux/poller.ts, server-v2/index.ts</files>
    <action>
      1. In poller.ts, import capturePane from commands.ts
      2. After building TmuxPane objects, capture terminal for Claude panes only (to limit overhead)
      3. Store captured content on the pane object (add terminalContent to TmuxPane type if needed)
      4. In index.ts polling callback, broadcast terminal_output for panes with content
      5. Only broadcast when content changes (track previous content hash)
      6. Use adaptive capture interval: 500ms for active Claude panes, skip idle ones
    </action>
    <verify>
      - Server starts without errors: `cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun run server-v2/index.ts`
      - Check logs show terminal capture happening
      - WebSocket messages include terminal_output type
    </verify>
    <done>Server captures and broadcasts terminal content for Claude panes</done>
  </task>

  <task id="3">
    <name>Verify end-to-end data flow</name>
    <files>src/components/PaneCard.tsx, src/components/FullScreenPane.tsx</files>
    <action>
      1. Start server and client
      2. Open dashboard, verify terminal content appears in PaneCard
      3. Expand a pane, verify terminal content appears in FullScreenPane
      4. Type in Claude session, verify content updates in UI
      5. Check browser console for any errors
      6. Test through Cloudflare tunnel if available
    </action>
    <verify>
      - Terminal content visible in compact PaneCard view
      - Terminal content visible in expanded FullScreenPane view
      - Content updates within ~500ms of changes
      - No console errors related to terminal
    </verify>
    <done>Terminal content displays correctly in all views</done>
  </task>
</plan>

## Commit Messages
- fix(client): update usePaneTerminal hook to use Zustand store
- feat(server): add terminal capture and broadcast to polling loop
