# Phase 2: Remove Competitions and Leaderboard

## Research Summary

### Files to DELETE
1. `server-v2/competitions/index.ts` - Competition module with leaderboard calculations
2. `src/routes/LeaderboardPage.tsx` - Leaderboard page route component
3. `src/components/CompetitionsPage.tsx` - Main competitions UI component
4. `src/components/LeaderboardCard.tsx` - Leaderboard card component
5. `src/hooks/useCompetitions.ts` - Competition data hook

### Files to MODIFY

**Server-side:**
1. `server-v2/api/routes.ts` - Remove `/api/competitions` route
2. `server-v2/api/handlers.ts` - Remove `listCompetitions` handler and `getAllCompetitions` import

**Client-side:**
1. `shared/types.ts` - Remove competition types (CompetitionCategory, TimePeriod, LeaderboardEntry, Competition, competitions ServerMessage)
2. `src/store/index.ts` - Remove CompetitionsState, competitions slice, setCompetitions action, useCompetition selector
3. `src/lib/websocket.ts` - Remove `competitions` message handler
4. `src/App.tsx` - Remove LeaderboardPage import and route
5. `src/components/Layout.tsx` - Remove leaderboard from sidebar and mobile nav

### Files to KEEP (no changes needed)
- `src/components/BottomNav.tsx` - Already deprecated/unused (Layout has inline nav)
- `src/components/QuestCard.tsx` - Just has text "leaderboard" in display string, not related

## Execution Order

1. Delete server module: `server-v2/competitions/index.ts`
2. Remove API route and handler (server-v2/api/routes.ts, handlers.ts)
3. Remove types from shared/types.ts
4. Remove store slice and actions (src/store/index.ts)
5. Remove WebSocket handler (src/lib/websocket.ts)
6. Delete client files (LeaderboardPage, CompetitionsPage, LeaderboardCard, useCompetitions)
7. Update App.tsx routes
8. Update Layout.tsx navigation

## Commits
- `refactor(server): remove competitions module`
- `refactor(api): remove /api/competitions endpoint`
- `refactor(types): remove competition types from shared/types`
- `refactor(client): remove competitions from store and websocket`
- `refactor(ui): remove leaderboard page and navigation`
