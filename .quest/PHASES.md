# Phases: Fix claude-rpg UI/UX Issues

## Phase Overview

| Phase | Name | Issues | Dependencies |
|-------|------|--------|--------------|
| 1 | Fix Avatar Loading | #1 | None |
| 2 | Fix Personas Status Detection | #2 | None |
| 3 | Fix Quest and Leaderboard Data | #3, #4 | None |
| 4 | Improve Persona Names | #5 | None |
| 5 | Improve Mobile UX and Layout | #6, #7, #8 | None |

---

## Phase 1: Fix Avatar Loading

**Goal**: Restore Bitcoin Face avatars that are currently showing as letter fallbacks.

**Scope**:
- `server-v2/personas/avatar.ts` - fetchBitcoinFace()
- `server-v2/api/avatars.ts` - serveAvatar()
- `server-v2/sessions/manager.ts` - where avatars are assigned to sessions
- `src/components/PaneAvatar.tsx` - client avatar rendering

**Investigation Points**:
1. Is avatarSvg being set on ClaudeSessionInfo when session is created?
2. Is fetchBitcoinFace() returning a valid URL or null?
3. Is the `/api/avatars/:seed` endpoint returning cached SVGs correctly?
4. Is PaneAvatar receiving the URL and rendering it correctly?

**Verification**:
- Start Claude in a tmux pane
- Check server logs for avatar fetch attempts
- Verify avatars directory exists and contains SVG files
- UI should show Bitcoin Face images instead of letter fallbacks

**Dependencies**: None

---

## Phase 2: Fix Personas Status Detection

**Goal**: Show correct online/working/idle status for Claude sessions on the Personas page instead of "offline".

**Scope**:
- `src/routes/PersonasPage.tsx` - status grouping logic
- `server-v2/sessions/manager.ts` - session status management
- `shared/types.ts` - SessionStatus type definition
- `src/store/index.ts` - how windows/panes are stored

**Investigation Points**:
1. How does PersonasPage determine if a persona is "offline"?
2. Is the status field properly populated on claudeSession?
3. Are WebSocket updates flowing correctly to update session status?
4. Compare with dashboard pane status detection

**Verification**:
- Start multiple Claude instances
- Personas page should show them as "Working" or "Ready" based on actual status
- Status should update in real-time when Claude starts/stops working

**Dependencies**: None

---

## Phase 3: Fix Quest and Leaderboard Data

**Goal**: Populate the Quests tab with actual quest data and fix the Leaderboard display.

**Scope**:
- `server-v2/quests/service.ts` - getActiveQuests() returns empty
- `server-v2/api/handlers.ts` - listQuests() API handler
- `server-v2/api/broadcast.ts` - WebSocket message types
- `src/hooks/useQuests.ts` - initial data fetch
- `src/components/QuestsPage.tsx` - quest display
- `src/components/CompetitionsPage.tsx` - "Competitions" label issue

**Tasks**:
1. Verify quests are being created and stored in database
2. Check if quests_init WebSocket message is being broadcast
3. Rename "Competitions" header to "Leaderboard" in UI
4. Debug why competitions data is empty

**Verification**:
- Create a quest via Claude Code skill
- Quest should appear on Quests page
- Leaderboard should show XP data for projects

**Dependencies**: None

---

## Phase 4: Improve Persona Names

**Goal**: Replace fantasy-style names ("Frost Mist", "Radiant Dragon") with more relatable names.

**Scope**:
- `server-v2/personas/names.ts` - ADJECTIVES and NOUNS arrays

**Options**:
1. **Human Names**: Alice, Bob, Charlie... (simple, relatable, matches prior code)
2. **Tech-themed**: Pixel, Cache, Vector, Query, Buffer... (more thematic)
3. **Adjective + Noun but friendlier**: "Happy Helper", "Swift Runner"...
4. **Single memorable words**: Spark, Echo, Dash, Sage...

**Recommendation**: Human names are most relatable. Previous code used English names before the fantasy naming was added.

**Verification**:
- Start new Claude sessions
- Names should feel more relatable and memorable

**Dependencies**: None

---

## Phase 5: Improve Mobile UX and Layout

**Goal**: Clean up redundant UI elements and improve mobile experience.

**Scope**:
- `src/components/Layout.tsx` - sidebar and mobile nav
- `src/components/OverviewDashboard.tsx` - header with stats/buttons
- `src/components/WorkersSummary` (inside OverviewDashboard) - truncated display

**Tasks**:

### 5.1 Fix Active Workers Truncation
- `OverviewDashboard.tsx` line 516: truncate w-16 is too narrow
- Show full name unless space truly constrained
- Consider responsive truncation

### 5.2 Remove Redundant Top Bar Elements
- Dashboard header has windows/panes counts that duplicate sidebar info
- Evaluate what to keep on dashboard vs what's in sidebar

### 5.3 Add Mobile Menu Collapse
- Add hamburger menu icon on mobile
- Allow sidebar to slide in/out on small screens
- Currently sidebar is hidden on mobile, only bottom nav shows

**Verification**:
- Test on mobile viewport (375px width)
- Sidebar should be collapsible/expandable
- Worker names should be readable
- No duplicate information between sidebar and main content

**Dependencies**: None (but best done after functional bugs are fixed)

---

## Execution Order

Recommended order: 1 -> 2 -> 3 -> 4 -> 5

Phases 1-4 can be done in parallel if multiple executors are available.

Phase 5 should be done last as it's polish work.

---

## Notes

- All phases can be executed independently (no blocking dependencies)
- Each phase is sized for a single Claude Code context window
- Testing should be done with actual tmux + Claude Code instances
- Server restart required after backend changes
