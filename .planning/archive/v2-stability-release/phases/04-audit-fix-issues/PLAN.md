# Phase 4: Audit and Fix Remaining Issues

## Goal
Clean up all TODOs, unimplemented features, and loose ends to prepare for stable release.

## Current State Assessment

### TODO Comments Found
1. `server-v2/tmux/poller.ts:189` - Hardcoded `attached: true` instead of checking actual tmux attachment status
2. `server-v2/personas/challenges.ts:313` - Warning logged when challenge XP service not initialized
3. `src/routes/ScratchpadPage.tsx:10` - Comment describing page purpose (not an issue)
4. `server-v2/personas/personality.ts:56` - Part of personality trait list (not an issue)

### CORS Configuration
- Currently using `Access-Control-Allow-Origin: '*'` in `server-v2/api/index.ts:131`
- Should restrict to actual request origin or specific tunnel domain

### Test Suite Status
- All 185 tests passing ✓
- No failures detected

### Control Mode TODO
- Not found in current codebase (may have been resolved in previous phases)

## Tasks

### Task 1: Fix CORS Configuration
**File:** `server-v2/api/index.ts`

**Action:**
Replace wildcard CORS with proper origin handling:
- Accept requests from the actual `Origin` header
- Keep wildcard for local development
- Log origin for debugging

**Verify:**
```bash
bun test
curl -H "Origin: https://example.com" http://localhost:4011/health
```

### Task 2: Fix Challenge XP Service Initialization
**File:** `server-v2/personas/challenges.ts`

**Action:**
The `addXp` parameter is optional but should always be provided by callers. Audit all call sites:
1. Search for all calls to `completeChallenge()`
2. Ensure all callers pass the `addXp` function
3. If any don't, update them to use the XP service
4. Remove the "service not initialized" warning if all callers are fixed

**Verify:**
```bash
grep -n "completeChallenge(" server-v2/ -r
bun test
```

### Task 3: Resolve Attachment Status TODO
**File:** `server-v2/tmux/poller.ts:189`

**Action:**
Investigate whether tmux attachment status is actually needed:
1. Check if any UI or logic depends on `attached` field
2. If yes, implement proper check using `tmux display-message -p '#{client_attached}'`
3. If no, document why hardcoded `true` is acceptable

**Verify:**
```bash
grep -rn "attached" src/ server-v2/
tmux display-message -p '#{client_attached}'
```

### Task 4: Final Code Audit
**Action:**
1. Check for any remaining console.log statements (should use logger)
2. Check for any unused imports
3. Check for any TypeScript `any` types that should be specific
4. Verify all async functions have error handling

**Verify:**
```bash
grep -rn "console\\.log" server-v2/ src/
bun test
bun run build
```

## Success Criteria

- [ ] CORS properly configured with origin checking
- [ ] Challenge XP service always initialized when needed
- [ ] Attachment status TODO resolved or documented
- [ ] All tests passing
- [ ] Clean build with no warnings
- [ ] Code ready for v2.0.0 stable tag

## Files Modified (Expected)

- `server-v2/api/index.ts` (CORS)
- `server-v2/personas/challenges.ts` (XP service)
- `server-v2/tmux/poller.ts` (attachment status)
- Possibly event handler files if XP service needs wiring

## Estimated Commits

3-4 atomic commits:
1. `fix(server): use request origin for CORS instead of wildcard`
2. `fix(server): ensure challenge XP service is always initialized`
3. `fix(server): resolve or document tmux attachment status TODO`
4. `chore: final code cleanup and audit`
