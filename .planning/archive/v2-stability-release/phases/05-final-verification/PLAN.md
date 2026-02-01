# Phase 5: Final Verification and Release

## Goal
Confirm everything works, document all changes, prepare for v2.0.0 stable release (user will tag/push)

## Status
Status: `in_progress`
Retry: 0

## Tasks

### Task 1: Build Verification
**Action:** Run clean build and verify no build errors
**Files:**
- `scripts/build-client.ts`
- `server-v2/index.ts`
- `package.json`

**Verify:**
```bash
# Clean build
rm -rf dist/client
bun run build

# Check build outputs
ls -lh dist/client/
ls -lh dist/client/assets/

# Verify no build errors in output
```

**Success criteria:**
- Build completes without errors
- Client assets exist in dist/client/
- Assets are properly hashed

### Task 2: Test Suite Verification
**Action:** Run full test suite and verify all tests pass
**Files:**
- `src/__tests__/**/*.test.tsx`
- `bun.lockb`

**Verify:**
```bash
bun test
```

**Success criteria:**
- All tests pass
- No TypeScript errors
- No test warnings

### Task 3: Runtime Verification
**Action:** Start server and check for console errors/warnings
**Files:**
- `server-v2/index.ts`
- `server-v2/config.ts`

**Verify:**
```bash
# Start server (manual check - don't leave running)
bun run server-v2/index.ts

# Check for:
# - Server starts without errors
# - WebSocket server initializes
# - Database migrations run
# - No unhandled promises
# - Heartbeat interval logs
```

**Success criteria:**
- Server starts cleanly
- No errors in console
- WebSocket available
- Database ready

### Task 4: Update CHANGELOG
**Action:** Create/update CHANGELOG.md with all changes from this quest
**Files:**
- `CHANGELOG.md` (create if missing)

**Content:**
Document all 14 commits from phases 1-4:

**Phase 1 (Terminal Content):**
- fix(client): update usePaneTerminal hook to use Zustand store
- feat(server): add terminal capture and broadcast to polling loop
- fix(server): update TerminalOutputMessage type to use payload wrapper
- fix(server): correct terminal_output broadcast message structure

**Phase 2 (Heartbeat):**
- feat(server): add heartbeat tracking to WebSocket handlers
- feat(server): create heartbeat module for connection keepalive
- feat(server): wire heartbeat into server lifecycle

**Phase 3 (Avatars):**
- fix(server): use correct bitcoinfaces API and add local caching
- feat(server): add /api/avatars/:seed endpoint to serve cached avatars
- fix(client): add error handling to PaneAvatar component

**Phase 4 (Cleanup):**
- fix(server): use request origin for CORS instead of wildcard
- fix(server): enforce challenge XP service initialization
- docs(server): document why tmux session attached status is hardcoded
- chore(server): replace console.error with logger in whisper module

**Verify:**
- CHANGELOG.md exists
- All changes documented
- Proper markdown formatting

**Success criteria:**
- CHANGELOG.md created/updated
- All 14 commits documented
- Grouped by category
- Follows conventional commit format

### Task 5: Update Documentation
**Action:** Verify CLAUDE.md reflects current state
**Files:**
- `CLAUDE.md`

**Verify:**
- Architecture diagram is current
- Data flow matches implementation
- WebSocket messages documented
- Build system section accurate

**Success criteria:**
- Documentation is accurate
- No outdated references
- All new features documented

## Completion Checklist
- [ ] Task 1: Build verification passed
- [ ] Task 2: Test suite passed
- [ ] Task 3: Runtime verification passed
- [ ] Task 4: CHANGELOG.md updated
- [ ] Task 5: Documentation verified
- [ ] No git tag created (user will do manually)
- [ ] No git push (user will do manually)

## Notes
- This is verification only - NO new code changes
- Do NOT create git tag - requires user approval
- Do NOT push to remote - user decides when to release
- Document everything for user to review before tagging v2.0.0
