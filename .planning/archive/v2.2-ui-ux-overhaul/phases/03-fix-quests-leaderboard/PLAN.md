# Phase 3: Fix Quest and Leaderboard Data

## Problem Analysis

### Quests Tab Empty
**Root cause:** The quest system exists in server-v2 but:
1. API handlers return data structure mismatch (`{ success: true, data: { quests } }` vs client expects array)
2. Client type mismatch - server uses `Quest` from `server-v2/quests/types.ts`, client expects `Quest` from `shared/types.ts`
3. These are completely different interfaces with different fields

**Shared types Quest:**
- Has: `name`, `repos[]`, `phases[]`, `status`, `createdAt` (number)
- Missing: `title`, `description`, `projectId`

**Server-v2 Quest:**
- Has: `title`, `description`, `projectId`, `status`, `phases`, `createdAt` (string ISO)
- Missing: `name`, `repos`

### Leaderboard Empty and Mislabeled
**Root cause:**
1. API route `/api/competitions` doesn't exist in server-v2
2. No handler for competitions in server-v2/api/handlers.ts
3. Client shows "Competitions" instead of "Leaderboard" (minor label fix)

## Solution

### Task 1: Add Competitions API to Server-v2
**Files:**
- `server-v2/api/routes.ts` - Add `/api/competitions` route
- `server-v2/api/handlers.ts` - Add `listCompetitions` handler
- `server-v2/competitions/index.ts` - Create competitions module (compute from stats)

**Action:**
1. Create `server-v2/competitions/index.ts` with `getAllCompetitions()` function
2. Query stats table to build leaderboards by category/period
3. Add handler in handlers.ts
4. Add route in routes.ts

**Verify:**
```bash
curl http://localhost:4011/api/competitions | jq
# Should return array of Competition objects with categories: xp, commits, tests, tools, prompts
```

### Task 2: Align Quest Types Between Server and Client
**Files:**
- `server-v2/quests/types.ts` - Remove (use shared/types.ts instead)
- `server-v2/quests/service.ts` - Update imports and field names
- `server-v2/api/handlers.ts` - Fix response structure (return array directly)
- `shared/types.ts` - Update Quest interface to match server needs

**Action:**
1. Update `shared/types.ts` Quest interface to include both `title` and `name` (name=title for now)
2. Update `shared/types.ts` to include `projectId` field
3. Convert server service to use shared types
4. Fix API handler to return `quests` array directly instead of wrapped object

**Verify:**
```bash
curl http://localhost:4011/api/quests | jq
# Should return array of Quest objects matching shared/types.ts
```

### Task 3: Rename "Competitions" to "Leaderboard" in UI
**Files:**
- `src/components/CompetitionsPage.tsx` - Change heading text

**Action:**
Change line 61 from `Competitions` to `Leaderboard`

**Verify:**
Visual check - page heading should say "Leaderboard"

### Task 4: Test Quest Creation Flow
**Files:**
- N/A (testing only)

**Action:**
1. Check if quest events are emitted from `.planning/` directories
2. Verify quests appear in Quests tab
3. Create a test quest to verify end-to-end

**Verify:**
- Quests tab shows active quest
- Quest data persists across server restarts

## Execution Order
1. Task 1 (Competitions API) - independent
2. Task 2 (Quest types) - independent
3. Task 3 (Label fix) - independent
4. Task 4 (Testing) - depends on 1-3

## Success Criteria
- [ ] `/api/competitions` returns leaderboard data
- [ ] `/api/quests` returns quest array matching shared types
- [ ] Quests tab displays active quests
- [ ] Leaderboard page shows "Leaderboard" heading
- [ ] Leaderboard displays XP, commits, tests, tools, prompts categories
