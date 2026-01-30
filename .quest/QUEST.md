# Quest: Fix claude-rpg UI/UX Issues

## Goal
Address 8 identified UI/UX issues to improve the claude-rpg companion app experience, from critical bugs (broken avatars, missing data) to polish (mobile UX, better naming).

## Repository
- Primary: `/home/whoabuddy/dev/whoabuddy/claude-rpg`

## Status
- Created: 2026-01-29
- Current Phase: Planning

## Issues Summary

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | Avatars not loading (showing letters) | Critical | Bug |
| 2 | Personas showing "offline" | Critical | Bug |
| 3 | Quests tab empty | High | Bug |
| 4 | Leaderboard empty and mislabeled | High | Bug |
| 5 | Random names not relatable | Medium | Feature |
| 6 | Top bar redundant with side menu | Medium | Polish |
| 7 | Mobile UX - collapsible menu | Medium | Feature |
| 8 | Active workers truncated | Low | Polish |

## Technical Context

### Architecture
- **Server**: Bun (server-v2/) with WebSocket + HTTP
- **Client**: React with Zustand store, React Router
- **Data Flow**: Server polls tmux -> broadcasts via WebSocket -> client store updates

### Key Files by Issue

**Avatars (Issue 1)**:
- `server-v2/personas/avatar.ts` - fetchBitcoinFace(), caching logic
- `server-v2/api/avatars.ts` - serveAvatar() endpoint
- `src/components/PaneAvatar.tsx` - client rendering

**Personas Status (Issue 2)**:
- `src/routes/PersonasPage.tsx` - shows "offline" via status detection
- `server-v2/sessions/manager.ts` - session state management
- Client receives via WebSocket `windows` message with panes

**Quests (Issue 3)**:
- `server-v2/quests/service.ts` - getActiveQuests()
- `server-v2/api/handlers.ts` - listQuests() returns only active
- `src/hooks/useQuests.ts` - fetches via API, receives WebSocket updates
- `src/components/QuestsPage.tsx` - renders quests

**Leaderboard (Issue 4)**:
- `src/routes/LeaderboardPage.tsx` - uses CompetitionsPage
- `src/components/CompetitionsPage.tsx` - title says "Competitions"
- `server-v2/api/broadcast.ts` - sends `competitions` message

**Names (Issue 5)**:
- `server-v2/personas/names.ts` - ADJECTIVES + NOUNS wordlists

**Layout (Issues 6, 7, 8)**:
- `src/components/Layout.tsx` - sidebar + bottom nav
- `src/components/OverviewDashboard.tsx` - header, WorkersSummary
