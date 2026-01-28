# Phases

## Phase 1: Notification System
**Status:** pending
**Issues:** #83, #84
**Goal:** Build a toast/notification component and wire it to XP gain, quest XP, and pane error WebSocket events.

- Create a reusable Toast/Notification component with auto-dismiss and stacking
- Listen to `xp_gain` WS event: show companion name, XP amount, source (e.g., "+15 XP from git commit")
- Listen to `quest_xp` WS event: show quest-specific XP with distinct styling
- Listen to `pane_error` WS event: show error banner with pane/companion context
- Mobile-friendly positioning (bottom or top edge, not blocking pane controls)
- Auto-dismiss after 3-5 seconds, stack multiple notifications

**Files:** src/components/Toast.tsx (new), src/hooks/useNotifications.ts, src/hooks/useWebSocket.ts, src/App.tsx

---

## Phase 2: Quest & API Management
**Status:** pending
**Issues:** #81, #86
**Goal:** Add quest management controls to QuestsPage and audit unused API endpoints.

- Add pause/resume toggle and complete button to QuestCard
- Wire to `PATCH /api/quests/:id` endpoint
- State updates via existing `quest_update` WebSocket (no polling)
- Evaluate unused endpoints: `GET /api/panes/:id`, `GET /api/competitions/:category`
- Remove or document endpoints based on evaluation
- Add confirmation dialog for quest completion

**Files:** src/components/QuestCard.tsx, src/components/QuestsPage.tsx, server/index.ts

---

## Phase 3: Competitions & Companions
**Status:** pending
**Issues:** #82, #85
**Goal:** Add streaks leaderboard to CompetitionsPage and companion-level prompt sending.

- Add "Streaks" tab to CompetitionsPage alongside existing categories
- Fetch from `GET /api/competitions/streaks` when tab selected
- Display: companion avatar, name, current streak (days), longest streak
- Add "Send prompt" UI to companion sidebar or detail view
- Wire to `POST /api/companions/:id/prompt`
- If multiple sessions, allow session selection via `POST /api/companions/:id/sessions/:id/prompt`

**Files:** src/components/CompetitionsPage.tsx, src/hooks/useCompetitions.ts, src/components/CompanionPrompt.tsx (new)

---

## Phase 4: Observability & Tracking
**Status:** pending
**Issues:** #80, #31, #29
**Goal:** Track and display system stats, token usage, and tool execution duration.

- Add system stats collection (CPU, memory, disk) to server polling loop
- Create SystemStats component for dashboard display
- Parse terminal output for token usage indicators (input/output tokens)
- Add `tokenUsage` field to ClaudeSessionInfo or SessionStats
- Track tool execution duration from pre_tool_use to post_tool_use events
- Add duration display to tool usage stats in companion view

**Files:** server/index.ts, server/system-stats.ts (new), shared/types.ts, src/components/SystemStats.tsx (new)

---

## Phase 5: Dashboard & Views
**Status:** pending
**Issues:** #53, #36, #32
**Goal:** Redesign dashboard with project-centric view, "Who's Working on What," and subagent visualization.

- Redesign OverviewDashboard for better information density
- Add "Who's Working on What" view: show active companions grouped by repo with current task
- Visualize subagent spawning: show Task tool spawns as child indicators on pane cards
- Track active subagent count per session (already in ClaudeSessionInfo.activeSubagents)
- Add visual tree/badge showing parent → subagent relationship

**Files:** src/components/OverviewDashboard.tsx, src/components/WhoWorkingView.tsx (new), src/components/PaneCard.tsx

---

## Phase 6: Navigation & Management
**Status:** pending
**Issues:** #59, #54, #48
**Goal:** Implement mobile navigation, session management, and window management from GUI.

- Add bottom navigation bar for mobile (Dashboard, Quests, Competitions, Settings)
- Implement page routing via nav bar (currently manual)
- Session management: start new Claude sessions, end sessions, view session history
- Window management: create windows, rename, close from GUI
- Wire to existing endpoints: `/api/windows/create`, `/api/windows/:id/rename`
- Add window controls to OverviewDashboard header

**Files:** src/components/Navigation.tsx (new), src/components/SessionManager.tsx (new), src/App.tsx, src/components/OverviewDashboard.tsx

---

## Phase 7: Input & UX Polish
**Status:** pending
**Issues:** #62, #34, #45, #77
**Goal:** Improve text selection, permission handling, npm script detection, and remaining design feedback.

- Implement text selection in terminal output (tap-and-hold or long-press on mobile)
- Add opt-in auto-accept for specific permission types (with warning/explanation)
- Detect available npm scripts from package.json in pane's cwd
- Show available scripts as quick-action buttons
- Address remaining design feedback from #77 (spacing, colors, typography)

**Files:** src/components/TerminalDisplay.tsx, src/components/PermissionPrompt.tsx, server/index.ts, src/components/PaneCard.tsx

---

## Phase 8: RPG & Achievements
**Status:** pending
**Issues:** #52, #37
**Goal:** Deepen RPG integration and implement the achievements system.

- Research and define the RPG relationship model (companion personality, evolution, specialization)
- Design achievement categories: milestones (first commit, 100 tools), streaks (7-day, 30-day), challenges (zero-retry quest)
- Implement achievement data model and persistence
- Create achievement unlock detection from existing XP/stats events
- Build AchievementsPage with unlock history and progress toward locked achievements
- Add achievement badges to companion profile

**Files:** server/achievements.ts (new), shared/types.ts, src/components/AchievementsPage.tsx (new), src/hooks/useAchievements.ts (new)
