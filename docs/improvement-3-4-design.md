# Design: Control Mode Streaming & State Reconciliation

## Overview

This document outlines improvements #3 (tmux control mode streaming) and #4 (session state reconciliation) for claude-rpg.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Current: Polling-based                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  setInterval(250ms)                setInterval(500ms)           │
│       │                                  │                      │
│       ▼                                  ▼                      │
│  pollTmuxState()              broadcastTerminalUpdates()        │
│  (tmux list-panes)            (tmux capture-pane per pane)      │
│       │                                  │                      │
│       ▼                                  ▼                      │
│  Compare hash                 Compare content string            │
│       │                                  │                      │
│       ▼                                  ▼                      │
│  Broadcast if changed         Broadcast if changed              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Problems:**
- Latency: 500ms delay between output and UI update
- CPU: Spawning `tmux capture-pane` for every pane every 500-2000ms
- Missing updates: Fast output can be missed between polls

## Improvement #3: Control Mode Streaming

### tmux Control Mode

When running `tmux -C attach-session`, tmux streams notifications:

```
%output %51 \033[38;5;174m✶\033[39m...  // Pane %51 produced output
%session-changed $0 work               // Session changed
%sessions-changed                      // Sessions added/removed
%layout-change @1 ...                  // Window layout changed
```

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Proposed: Hybrid (Polling + Streaming)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────────┐          │
│  │ Control Mode     │         │ Structure Poller     │          │
│  │ (streaming)      │         │ (250ms fallback)     │          │
│  └────────┬─────────┘         └──────────┬───────────┘          │
│           │                              │                      │
│           ▼                              ▼                      │
│  %output pane-id value        tmux list-panes -a               │
│  %sessions-changed            (for new panes, removals)         │
│           │                              │                      │
│           ▼                              ▼                      │
│  Update terminal buffer       Update windows array              │
│  (immediate)                  (only on structure change)        │
│           │                              │                      │
│           └──────────┬───────────────────┘                      │
│                      ▼                                          │
│              WebSocket broadcast                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### 1. TmuxControlClient class

```typescript
// server/tmux-control.ts

interface TmuxNotification {
  type: 'output' | 'session-changed' | 'sessions-changed' | 'layout-change' | 'window-add' | 'window-close'
  paneId?: string
  data?: string
  // ... other fields per notification type
}

class TmuxControlClient extends EventEmitter {
  private process: ChildProcess | null = null
  private buffer: string = ''

  async connect(): Promise<void> {
    this.process = spawn('tmux', ['-C', 'attach-session'])

    this.process.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString()
      this.processBuffer()
    })
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // Keep incomplete line

    for (const line of lines) {
      const notification = this.parseLine(line)
      if (notification) {
        this.emit('notification', notification)
      }
    }
  }

  private parseLine(line: string): TmuxNotification | null {
    if (line.startsWith('%output ')) {
      const match = line.match(/^%output (%\d+) (.*)$/)
      if (match) {
        return {
          type: 'output',
          paneId: match[1],
          data: this.unescapeOutput(match[2])
        }
      }
    }
    // Parse other notification types...
    return null
  }

  private unescapeOutput(escaped: string): string {
    // Convert \xxx octal escapes back to characters
    return escaped.replace(/\\(\d{3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8))
    )
  }

  sendCommand(cmd: string): void {
    this.process?.stdin?.write(cmd + '\n')
  }

  disconnect(): void {
    this.process?.kill()
    this.process = null
  }
}
```

#### 2. Terminal Buffer per Pane

```typescript
// server/terminal-buffer.ts

class TerminalBuffer {
  private lines: string[] = []
  private maxLines: number = 100

  append(data: string): void {
    // Parse ANSI sequences, handle cursor movement
    // Append to buffer
  }

  getContent(): string {
    return this.lines.join('\n')
  }

  getLastNLines(n: number): string {
    return this.lines.slice(-n).join('\n')
  }
}

// Map of pane ID to buffer
const paneBuffers = new Map<string, TerminalBuffer>()
```

#### 3. Integration with Existing Code

```typescript
// In server/index.ts

const controlClient = new TmuxControlClient()

controlClient.on('notification', (notif: TmuxNotification) => {
  if (notif.type === 'output' && notif.paneId && notif.data) {
    // Update terminal buffer immediately
    let buffer = paneBuffers.get(notif.paneId)
    if (!buffer) {
      buffer = new TerminalBuffer()
      paneBuffers.set(notif.paneId, buffer)
    }
    buffer.append(notif.data)

    // Broadcast immediately (debounced)
    debouncedBroadcastTerminal(notif.paneId)
  }

  if (notif.type === 'sessions-changed') {
    // Trigger structure poll
    pollTmux()
  }
})

// Start control client
controlClient.connect()
```

### Fallback Strategy

Keep polling as fallback:
- Control mode may disconnect
- New panes may not be tracked immediately
- Some edge cases need capture-pane

```typescript
// Reduce poll frequency when control mode is connected
const POLL_INTERVAL_WITH_CONTROL = 2000  // 2s fallback
const POLL_INTERVAL_WITHOUT_CONTROL = 250 // Original speed

let pollInterval = POLL_INTERVAL_WITHOUT_CONTROL

controlClient.on('connect', () => {
  pollInterval = POLL_INTERVAL_WITH_CONTROL
})

controlClient.on('disconnect', () => {
  pollInterval = POLL_INTERVAL_WITHOUT_CONTROL
})
```

---

## Improvement #4: Session State Reconciliation

### Current State Sources

1. **Hook events** - PreToolUse, PostToolUse, Stop, etc.
2. **Terminal content** - Parsed via `parseTerminalForPrompt()`

### Problem

State can drift when:
- Hook events are missed (network issue, race condition)
- Terminal output not matching expected patterns
- Claude restarts without SessionStart hook

### Proposed Solution: State Reconciliation Layer

```typescript
// server/state-reconciler.ts

interface ReconciliationResult {
  stateChanged: boolean
  newStatus?: ClaudeSessionStatus
  newPrompt?: TerminalPrompt
  confidence: 'high' | 'medium' | 'low'
}

function reconcileSessionState(
  pane: TmuxPane,
  terminalContent: string,
  hookState: ClaudeSessionInfo
): ReconciliationResult {
  const terminalPrompt = parseTerminalForPrompt(terminalContent)
  const terminalState = inferStateFromTerminal(terminalContent)

  // Case 1: Terminal shows prompt, hook says working
  // → Trust terminal, update to waiting
  if (terminalPrompt && hookState.status === 'working') {
    return {
      stateChanged: true,
      newStatus: 'waiting',
      newPrompt: terminalPrompt,
      confidence: 'high'
    }
  }

  // Case 2: Terminal shows idle prompt (❯), hook says working
  // → Claude finished, hook was missed
  if (terminalState === 'idle' && hookState.status === 'working') {
    // Check if last activity was recent
    const timeSinceActivity = Date.now() - hookState.lastActivity
    if (timeSinceActivity > 5000) { // 5s threshold
      return {
        stateChanged: true,
        newStatus: 'idle',
        confidence: 'medium'
      }
    }
  }

  // Case 3: Hook says waiting but no prompt visible
  // → Prompt was answered, hook was missed
  if (!terminalPrompt && hookState.status === 'waiting' && hookState.pendingQuestion) {
    const timeSinceQuestion = Date.now() - hookState.pendingQuestion.timestamp
    if (timeSinceQuestion > 2000) { // 2s threshold
      return {
        stateChanged: true,
        newStatus: 'working', // Assume Claude is processing answer
        confidence: 'medium'
      }
    }
  }

  // No reconciliation needed
  return { stateChanged: false, confidence: 'high' }
}

function inferStateFromTerminal(content: string): 'idle' | 'working' | 'unknown' {
  const cleaned = stripAnsi(content)
  const lines = cleaned.trim().split('\n')
  const lastLine = lines[lines.length - 1]?.trim() || ''

  // Check for shell prompt (indicates Claude exited or idle)
  const shellPromptPatterns = [
    /^[❯›>$#%]\s*$/,           // Simple prompts
    /^\w+@\w+.*[#$%>]\s*$/,    // user@host prompts
    /^\(\w+\).*[#$%>]\s*$/,    // (venv) prompts
  ]

  for (const pattern of shellPromptPatterns) {
    if (pattern.test(lastLine)) {
      return 'idle'
    }
  }

  // Check for Claude working indicators
  const workingPatterns = [
    /Thinking\.\.\./,
    /Working\.\.\./,
    /Reading.*\.\.\./,
    /Writing.*\.\.\./,
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,  // Spinner characters
  ]

  for (const pattern of workingPatterns) {
    if (pattern.test(cleaned)) {
      return 'working'
    }
  }

  return 'unknown'
}
```

### Integration

```typescript
// In broadcastTerminalUpdates()

if (isClaudePane && pane.process.claudeSession) {
  const session = pane.process.claudeSession

  // Existing prompt detection
  const newPrompt = parseTerminalForPrompt(content)

  // NEW: Run reconciliation
  const reconciliation = reconcileSessionState(pane, content, session)

  if (reconciliation.stateChanged) {
    console.log(`[reconciler] State drift detected for ${pane.id}: ` +
      `${session.status} → ${reconciliation.newStatus} ` +
      `(confidence: ${reconciliation.confidence})`)

    const updated = updateClaudeSession(pane.id, {
      status: reconciliation.newStatus,
      terminalPrompt: reconciliation.newPrompt,
    })

    if (updated) {
      pane.process.claudeSession = updated
      savePanesCache()
      broadcast({ type: 'pane_update', payload: pane })
    }
  }
}
```

---

## Implementation Order

1. **Phase 1: State Reconciliation (#4)**
   - Add `inferStateFromTerminal()`
   - Add `reconcileSessionState()`
   - Integrate into terminal capture loop
   - Test with simulated state drift

2. **Phase 2: Control Mode (Basic) (#3)**
   - Implement `TmuxControlClient`
   - Parse `%output` notifications
   - Update terminal buffers immediately
   - Keep polling as fallback

3. **Phase 3: Control Mode (Full)**
   - Handle `%sessions-changed`, `%layout-change`
   - Reduce polling when control mode active
   - Add reconnection logic
   - Performance tuning

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Control mode disconnects | Keep polling as fallback |
| Output parsing errors | Robust octal escape handling |
| State reconciliation false positives | Confidence levels + time thresholds |
| Memory usage with buffers | Limit buffer size, prune old data |
| Race between control mode & polling | Use single source of truth (Map) |

---

## Testing Plan

1. **Unit tests** for `TmuxControlClient.parseLine()`
2. **Unit tests** for `reconcileSessionState()`
3. **Integration test**: Start Claude, verify state transitions
4. **Stress test**: Many panes, high output volume
5. **Failure test**: Kill control mode, verify fallback works
