# Quest Phases

## Phase 1: Fix critical input bug
**Issues:** #87
**Status:** completed
**Complexity:** Small
**Dependencies:** None

Fix Enter key in PaneInput - Enter should send message, Shift+Enter should add newline. Currently Enter appends content instead of submitting.

## Phase 2: Backend data collection
**Issues:** #29, #31, #80, #45
**Status:** completed
**Complexity:** Medium
**Dependencies:** None (parallel with Phase 1)

Add backend tracking: tool execution duration (#29), token usage from terminal output (#31), basic system stats (#80), and npm script detection (#45). These enrich the data model for later phases.

## Phase 3: Input and interaction polish
**Issues:** #77 (partial), #62, #34
**Status:** completed
**Complexity:** Medium
**Dependencies:** Phase 1

Polish input area per design feedback (#77): consistent button layout, text selection (#62), auto-accept permission bypass opt-in (#34).

## Phase 4: Navigation and routing
**Issues:** #59, #53, #48
**Status:** completed
**Complexity:** Large
**Dependencies:** Phase 3

Mobile navigation (#59), revised dashboard display (#53), window management UI controls (#48). Add React Router for page routing (leaderboard, quests, dashboard as separate pages per #77). Top bar HUD redesign from #77.

## Phase 5: Session and subagent management
**Issues:** #54, #32
**Status:** completed
**Complexity:** Medium
**Dependencies:** Phase 4

Session management (#54) and subagent spawning visualization (#32). Requires navigation to be in place for session views.

## Phase 6: Notification system
**Issues:** #84, #83, #85
**Status:** completed
**Complexity:** Medium
**Dependencies:** Phases 2, 4

Pane error notifications (#84), XP gain and quest notifications (#83), send prompts to companions (#85). Depends on backend tracking data (Phase 2) and navigation (Phase 4).

## Phase 7: RPG feature pages
**Issues:** #82, #81, #36
**Status:** completed
**Complexity:** Medium
**Dependencies:** Phases 4, 6

Streaks leaderboard (#82), quest management controls (#81), who's working on what view (#36). Requires page routing and notification infrastructure.

## Phase 8: Achievements and RPG design
**Issues:** #37, #52
**Status:** completed
**Complexity:** Large
**Dependencies:** Phases 2, 6, 7

Achievements system (#37) and RPG relationship exploration (#52). Uses tracking data from Phase 2 and RPG feature pages from Phase 7.

## Phase 9: Audit and cleanup
**Issues:** #86
**Status:** completed
**Complexity:** Small
**Dependencies:** All prior phases

Audit and clean up unused API endpoints. Must be last since earlier phases may add/change endpoints.
