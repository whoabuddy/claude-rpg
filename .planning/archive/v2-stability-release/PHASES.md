# Phases

## Phase 1: Fix Terminal Content Data Flow
Goal: Restore terminal content visibility by fixing the broken data pipeline
Status: `completed`

**Problems:**
1. `usePaneTerminal` listens for CustomEvent `terminal_output` on `window`
2. `websocket.ts` calls `store.setTerminalContent()` instead of dispatching event
3. `server-v2/tmux/poller.ts` never captures terminal content

**Tasks:**
- [ ] Add terminal capture to server-v2 polling loop (use `capturePane` from commands.ts)
- [ ] Broadcast `terminal_output` messages from server
- [ ] Fix client: either dispatch CustomEvent OR update hook to use store directly
- [ ] Verify terminal displays in PaneCard and FullScreenPane

## Phase 2: Implement WebSocket Heartbeat
Goal: Keep connections alive through Cloudflare tunnel with proper ping/pong
Status: `completed`

**Problems:**
1. `wsHeartbeatInterval: 30000` config exists but never used
2. No ping/pong mechanism in `server-v2/api/ws.ts`
3. Silent connection death through reverse proxies

**Tasks:**
- [ ] Add server-side ping interval using config value
- [ ] Track client liveness (last pong time)
- [ ] Close stale connections after missed pongs
- [ ] Add client-side pong response (or verify browser handles automatically)
- [ ] Test with tunnel - verify connection survives idle periods

## Phase 3: Fix Avatar Loading
Goal: Avatars load reliably with correct API and local caching
Status: `completed`

**Problems:**
1. Wrong API URL: Using `/api/face` instead of `/api/get-image/<string>`
2. Dicebear fallback URL exists (remove it)
3. No local caching - external request every time
4. No `onError` fallback in UI

**Tasks:**
- [x] Fix API URL to `bitcoinfaces.xyz/api/get-image/<string>`
- [x] Remove dicebear fallback (only use bitcoinfaces.xyz)
- [x] Add local disk cache for avatar SVGs
- [x] Add `/api/avatar/:seed` endpoint to serve cached avatars
- [x] Add `onError` handler to PaneAvatar.tsx (show initials)
- [ ] Migrate existing avatar URLs in database (not needed - graceful fallback)

## Phase 4: Audit and Fix Remaining Issues
Goal: Clean up all TODOs, unimplemented features, and loose ends
Status: `completed`

**Known Issues:**
- Challenge XP service not initialized
- CORS too permissive (should restrict to tunnel domain)
- Attachment status TODO in poller.ts
- Control mode investigation TODO in server/index.ts

**Tasks:**
- [x] Grep for all TODO/FIXME/HACK comments
- [x] Initialize challenge XP service properly
- [x] Restrict CORS to actual request origin
- [x] Resolve or document remaining TODOs
- [x] Run full test suite, fix any failures
- [ ] Manual testing through tunnel (phase 5)

## Phase 5: Final Verification and Release
Goal: Confirm everything works, cut v2.0.0 stable release
Status: `completed`

**Tasks:**
- [ ] Fresh clone and build test
- [ ] Test all features through Cloudflare tunnel
- [ ] Verify no console errors
- [ ] Update CHANGELOG.md
- [ ] Tag v2.0.0
