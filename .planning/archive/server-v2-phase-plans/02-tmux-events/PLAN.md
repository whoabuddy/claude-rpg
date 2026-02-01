# Phase 2: Tmux and Events

## Goal
Implement tmux polling and event bus for decoupled communication.

## Context
- Existing tmux.ts in server/ for reference
- Event bus enables loose coupling between modules
- Issues: #117, #118

<plan>
  <goal>Create tmux polling module and typed event bus</goal>
  <context>
    - Tmux commands: list-windows, list-panes, capture-pane, send-keys
    - Process detection via `pgrep` and `/proc` on Linux
    - Event bus should be type-safe with handler priority
    - Reference existing server/tmux.ts for patterns
  </context>

  <task id="1">
    <name>Implement tmux polling and process detection</name>
    <files>server-v2/tmux/index.ts, server-v2/tmux/poller.ts, server-v2/tmux/process.ts, server-v2/tmux/types.ts</files>
    <action>
      1. Create tmux/types.ts:
         - TmuxSession, TmuxWindow, TmuxPane interfaces
         - PaneProcess type: 'claude' | 'shell' | 'process' | 'idle'
         - ProcessInfo interface
      2. Create tmux/process.ts:
         - classifyProcess(pid): PaneProcess
         - Detect Claude Code via command name and args
         - Get working directory from /proc/{pid}/cwd
         - Handle errors gracefully (process may exit)
      3. Create tmux/poller.ts:
         - pollTmux(): Promise<TmuxWindow[]>
         - Parse tmux list-windows and list-panes output
         - Enrich panes with process classification
         - Extract working directory for project detection
         - Configurable poll interval from config
      4. Create tmux/index.ts:
         - Export public API
         - startPolling(callback, interval)
         - stopPolling()
    </action>
    <verify>
      Import and call pollTmux(), verify it returns window/pane structure
      Verify Claude detection works when Claude Code is running
    </verify>
    <done>Tmux polling returns accurate window/pane state with process info</done>
  </task>

  <task id="2">
    <name>Implement tmux commands module</name>
    <files>server-v2/tmux/commands.ts</files>
    <action>
      1. Create tmux/commands.ts:
         - sendKeys(paneId, text): Promise<void>
         - capturePane(paneId, lines?): Promise<string>
         - createWindow(session, name?): Promise<string>
         - createPane(windowId): Promise<string>
         - closePane(paneId): Promise<void>
         - closeWindow(windowId): Promise<void>
         - renameWindow(windowId, name): Promise<void>
      2. Use Bun.spawn() for command execution
      3. Handle tmux not running gracefully
      4. Log commands at debug level
    </action>
    <verify>
      Call sendKeys to a test pane, verify text appears
      Call capturePane, verify content returned
    </verify>
    <done>All tmux commands work reliably</done>
  </task>

  <task id="3">
    <name>Implement typed event bus</name>
    <files>server-v2/events/index.ts, server-v2/events/bus.ts, server-v2/events/types.ts</files>
    <action>
      1. Create events/types.ts:
         - Define all event types as discriminated union
         - Tmux events: pane:discovered, pane:removed, pane:changed, window:created, window:removed
         - Hook events: pre_tool_use, post_tool_use, stop, user_prompt, notification
         - Domain events: persona:created, project:created, xp:awarded, quest:status_changed
         - System events: server:starting, server:ready, server:stopping
      2. Create events/bus.ts:
         - EventBus class with typed emit/on/off
         - Handler priority (higher runs first)
         - Async handler support
         - Error isolation (log but don't crash on handler error)
         - Handler count tracking for debugging
      3. Create events/index.ts:
         - Export singleton eventBus instance
         - Export types
    </action>
    <verify>
      Subscribe to event, emit event, verify handler called
      Verify error in handler doesn't crash bus
    </verify>
    <done>Event bus handles typed events with priority ordering</done>
  </task>
</plan>

## Verification Criteria
- [ ] Tmux poller discovers all panes
- [ ] Claude instances correctly detected
- [ ] Working directory extracted for project association
- [ ] Tmux commands execute reliably
- [ ] Event bus fires events to handlers
- [ ] Handler errors don't crash the bus
