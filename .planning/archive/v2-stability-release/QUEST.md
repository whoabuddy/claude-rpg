# Quest: Claude RPG v2.x Stable Release

## Goal

Ship a stable, reliable v2.x release that works flawlessly over Cloudflare tunnel. Fix all connection issues, complete unimplemented features, and ensure code is production-ready with no leftover TODOs or broken data flows.

## Status

**Created:** 2026-01-29
**Completed:** 2026-01-30
**Status:** completed

## Critical Issues Identified

### 1. WebSocket Connection Reliability (HIGH)
- `wsHeartbeatInterval` config exists but heartbeat is **never implemented**
- No ping/pong mechanism - connections die silently through tunnel
- Cloudflare tunnels timeout idle connections after ~100s

### 2. Terminal Content Not Loading (HIGH)
- **Data flow is broken**: `usePaneTerminal` hook listens for CustomEvent `terminal_output`
- But `websocket.ts` calls `store.setTerminalContent()` - completely different path!
- Components never receive terminal updates because no CustomEvent is dispatched
- Server-v2 `poller.ts` doesn't capture or broadcast terminal content at all

### 3. Avatar Loading Broken (MEDIUM)
- Wrong API: Using `bitcoinfaces.xyz/api/face` instead of `bitcoinfaces.xyz/api/get-image/<string>`
- Dicebear fallback URL should be removed
- No local caching - every request goes external
- No error handling in UI when images fail

### 4. Unimplemented/Incomplete Features
- Challenge XP service not initialized (server-v2/personas/challenges.ts:313)
- TODO: Check actual tmux attachment status (server-v2/tmux/poller.ts:175)
- CORS is overly permissive (`*` instead of specific origin)

## Repositories

- `whoabuddy/claude-rpg` (primary)

## Success Criteria

1. WebSocket stays connected through Cloudflare tunnel indefinitely
2. Terminal content displays correctly in all pane views
3. Avatar images load reliably with local caching
4. No console errors, no broken data flows
5. All TODOs resolved or documented as intentional
6. Clean `bun test` pass
7. Ready to tag v2.0.0 stable
