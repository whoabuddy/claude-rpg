# Future Enhancement: Message Sequence Numbers

## Goal

Add sequence numbers to terminal_output messages to enable client-side gap detection.

## Current State

Terminal output messages are HIGH priority and always sent, but there's no mechanism to detect if a message was lost due to:
- Network failure
- WebSocket reconnection
- Client crash/recovery

## Proposed Solution

### Server Changes

1. Add sequence counter per pane in `server-v2/index.ts`:
```typescript
const terminalSeq = new Map<string, number>()

function getNextSeq(paneId: string): number {
  const current = terminalSeq.get(paneId) ?? 0
  const next = current + 1
  terminalSeq.set(paneId, next)
  return next
}
```

2. Update `TerminalOutputMessage` type:
```typescript
export interface TerminalOutputMessage {
  type: 'terminal_output'
  payload: {
    paneId: string
    target: string
    content: string
    seq: number  // NEW
  }
}
```

3. Add refresh endpoint:
```typescript
// POST /api/panes/:id/terminal/refresh?from=123
// Returns all cached terminal content with seq >= from
```

### Client Changes

1. Track last received seq per pane in Zustand store
2. Detect gaps on message receive:
```typescript
if (msg.payload.seq !== lastSeq + 1) {
  // Gap detected - request refresh
  fetch(`/api/panes/${paneId}/terminal/refresh?from=${lastSeq + 1}`)
}
```

3. Handle reconnection:
```typescript
// On WebSocket reconnect, verify seq for all active panes
for (const pane of activePanes) {
  const serverSeq = await fetch(`/api/panes/${pane.id}/terminal/seq`)
  if (serverSeq !== clientSeq) {
    // Request missing messages
  }
}
```

## Benefits

- Guaranteed terminal content consistency
- Automatic recovery from missed messages
- Better debugging (log seq gaps)

## Trade-offs

- Small overhead (4 bytes per message for seq number)
- Server needs to cache recent terminal content (already does in `terminalContentCache`)
- Client complexity (gap detection logic)

## When to Implement

Consider implementing when:
1. Users report missing terminal updates (none so far)
2. WebSocket reconnection becomes common
3. Running over unreliable networks (mobile, satellite)

## Related

- Phase 4 (Incremental Diffs) will need sequence numbers for diff ordering
- This should be implemented together with Phase 4
