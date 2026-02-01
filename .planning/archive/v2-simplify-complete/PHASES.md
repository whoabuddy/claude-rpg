# Phases: Simplify claude-rpg v2

Ordered by dependency. Each phase is independently verifiable and completable in a single session.

---

## Phase 1: Remove personality traits system [COMPLETED]

**Goal**: Delete the 61-trait personality generation that adds backstories and quirks to personas.

**Status**: Completed on 2026-01-31 (commit 87adbd3)

**What was done**:
- Deleted `server-v2/personas/personality.ts` file
- Removed `PersonaPersonality` type from `shared/types.ts`, `server-v2/personas/types.ts`, `server-v2/tmux/types.ts`
- Removed `personality` field from `ClaudeSessionInfo` and `Persona` interfaces
- Updated `server-v2/personas/service.ts` to remove personality generation calls
- Updated `server-v2/tmux/session-builder.ts` to remove personality references
- Kept `PersonaBadges.tsx` (displays specialization badges, not personality traits)

**Verification**:
- `grep -r "backstory\|quirk" src/ server-v2/` returns no results
- `grep -r "PersonaPersonality" .` returns no results
- Server starts without errors
- Client builds without errors

---

## Phase 2: Remove competitions and leaderboard [COMPLETED]

**Goal**: Delete the competition categories, leaderboard calculations, and leaderboard page. Keep the underlying stats logging for future use.

**Status**: Completed on 2026-01-31 (commits 868fb28, 089bbc8)

**What was done**:
- Deleted `server-v2/competitions/` directory
- Removed `/api/competitions` route and `listCompetitions` handler
- Removed Competition types from `shared/types.ts` (CompetitionCategory, TimePeriod, LeaderboardEntry, Competition)
- Removed `competitions` ServerMessage type
- Removed competitions slice and actions from Zustand store
- Removed `competitions` WebSocket message handler
- Deleted `src/routes/LeaderboardPage.tsx`
- Deleted `src/components/CompetitionsPage.tsx`
- Deleted `src/components/LeaderboardCard.tsx`
- Deleted `src/hooks/useCompetitions.ts`
- Deleted `src/components/BottomNav.tsx` (unused legacy component)
- Removed `/leaderboard` route from `App.tsx`
- Removed leaderboard from sidebar and mobile navigation in `Layout.tsx`
- Updated QuestCard to remove "leaderboard" display text

**Verification**:
- `grep -r "Competition\|Leaderboard\|leaderboard" src/` returns no results
- Server starts without errors
- Client builds without errors (40 files: 38 JS, 1 CSS, 1 HTML)
- Navigation shows: Dashboard, Quests, Scratchpad, Settings

---

## Phase 3: Consolidate to single-screen UI [COMPLETED]

**Goal**: Merge essential features into a single dashboard view. Remove page-based navigation on mobile.

**Status**: Completed on 2026-01-31 (commits 8be4e65, d469a92, 77ac8b9, 71da63c, 93f3952, 444107a)

**What was done**:
- Created SlidePanel component for slide-out panel UI
- Extracted QuestsPanel from QuestsPage (reusable in panel or standalone)
- Extracted ScratchpadPanel from ScratchpadPage (reusable in panel or standalone)
- Added QuestsSummary and QuickCaptureCompact inline on dashboard
- Updated OverviewDashboard to show quests/scratchpad buttons that open panels
- Removed mobile bottom navigation entirely
- Simplified desktop sidebar to: Dashboard, Settings
- Added mobile header bar with app name, attention badge, connection status, settings link
- Refactored QuestsPage and ScratchpadPage to use the panel components

**Verification**:
- `npm run build` succeeds (44 files: 42 JS, 1 CSS, 1 HTML)
- Mobile view shows single screen with panels accessible via buttons
- No bottom tab bar on mobile
- Desktop sidebar has only Dashboard and Settings

---

## Phase 4: Enhance text-first mobile experience [COMPLETED]

**Goal**: Strip visual chrome, maximize information density, improve touch interactions.

**Status**: Completed on 2026-01-31 (commits be64658, 0a9cab1, 776ebac, 47b3b0e)

**What was done**:
- Deleted `CelebrationOverlay.tsx` and related CSS animations (was unused, events never dispatched)
- Deleted `RadarChart.tsx`, stats now shown in grid format only in ProjectDetailPage
- Simplified `StatusIndicator` to color-coded text only, removed dot indicator
- Added `text` property to `STATUS_THEME` for consistent text colors
- Compacted `PaneCard`:
  - Reduced padding from p-3 to px-2 py-1.5
  - Removed avatar in compact mode
  - Removed branch from compact mode display
  - Removed SessionStatsBar from expanded view
- Reduced `TerminalDisplay` padding from p-3 to p-2, removed border

**Deferred**:
- Swipe gestures for common actions (complexity vs benefit)

**Verification**:
- `npm run build` succeeds (44 files)
- PaneCard shows: repo name, worker name, status word (color-coded)
- No radar charts in UI
- No celebration animations
- Touch targets remain accessible (min-h-[36px] on compact cards)

---

## Phase 5: Document and preserve narrative system [COMPLETED]

**Goal**: Document how narrative generation works before simplification. Ensure it remains functional for project detail views.

**Status**: Completed on 2026-01-31 (commits a87e423, c97a43d)

**What was done**:
- Added comprehensive integration tests for narrative generation (`server-v2/__tests__/narrative.test.ts`)
  - Tests cover: empty project, single contributor, multiple contributors, edge cases
  - 12 tests, 54 assertions, all passing
- Documented narrative system in CLAUDE.md:
  - Data flow diagram (XP Events -> aggregation.ts -> narrative.ts -> NarrativeSummary)
  - Key files table with responsibilities
  - TeamStats structure explanation
  - Narrative generation algorithm description
  - API usage examples
- Verified GET /api/projects/:id/narrative endpoint works (both json and markdown formats)
- Cleaned up stale competition references in CLAUDE.md (removed in phase 2)
- Confirmed ProjectDetailPage already displays narrative summary (NarrativeSummary component)

**Verification**:
- `bun test server-v2/__tests__/narrative.test.ts` passes (12 tests)
- `curl http://localhost:4011/api/projects/:id/narrative?format=json` returns valid response
- `curl http://localhost:4011/api/projects/:id/narrative?format=markdown` returns markdown text
- Narrative system documentation in CLAUDE.md under "## Narrative System" section

---

## Dependency Graph

```
Phase 1 (traits) ─┐
                  ├─> Phase 3 (single screen) ─> Phase 4 (text-first)
Phase 2 (competitions) ─┘
                              │
Phase 5 (narrative docs) ─────┘ (can run in parallel with 3-4)
```

Phases 1 and 2 are independent and can be done in either order.
Phase 3 depends on 1 and 2 (navigation changes require removed pages).
Phase 4 depends on 3 (styling requires finalized component structure).
Phase 5 is independent and can run in parallel with 3-4.
