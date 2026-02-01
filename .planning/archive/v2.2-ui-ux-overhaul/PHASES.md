# Phases

## Phase 1: Fix Avatar Loading
Goal: Restore Bitcoin Face avatars that are currently showing as letter fallbacks
Status: `completed`

**Problems:**
1. Just implemented caching in previous quest - may be a bug
2. Avatar URLs may not be generated/stored correctly
3. API endpoint may not serve cached avatars properly
4. Client may not handle new URL format

**Scope:**
- server-v2/personas/avatar.ts - fetchBitcoinFace() and caching
- server-v2/api/avatars.ts - serveAvatar() endpoint
- server-v2/sessions/manager.ts - where avatars are assigned
- src/components/PaneAvatar.tsx - client rendering

## Phase 2: Fix Personas Status Detection
Goal: Show correct online/working/idle status instead of all showing "offline"
Status: `completed`

**Problems:**
1. Status grouping logic may be wrong
2. Session state may not propagate to personas
3. Status values may not match expected enum

**Scope:**
- src/routes/PersonasPage.tsx - status grouping logic
- server-v2/sessions/manager.ts - session state
- shared/types.ts - SessionStatus type

## Phase 3: Fix Quest and Leaderboard Data
Goal: Populate Quests tab and fix Leaderboard display
Status: `completed`

**Problems:**
1. Quest events may not be received/processed
2. Quest data not persisted or fetched correctly
3. Leaderboard labeled "competitions" incorrectly
4. Leaderboard data not populated

**Scope:**
- Server: quests service, API handlers
- Client: QuestsPage, CompetitionsPage (rename to Leaderboard)
- Check quest event emission from skills

## Phase 4: Improve Persona Names
Goal: Replace fantasy names with more relatable names
Status: `completed`

**Problems:**
1. Current names like "Frost Mist", "Radiant Dragon" are meaningless
2. Names don't help identify which Claude instance is which

**Solution:**
- Replaced ADJECTIVES + NOUNS with FIRST_NAMES array (110 diverse human names)
- Names now include: Alice, Charlie, Maya, Jordan, etc.
- Maintains deterministic generation from session ID
- Existing sessions keep their names (deterministic), new sessions get human names

**Scope:**
- server-v2/personas/names.ts - ADJECTIVES and NOUNS arrays

## Phase 5: Improve Mobile UX and Layout
Goal: Clean up redundant UI and improve mobile experience
Status: `completed`

**Problems:**
1. Top bar duplicates side menu functionality - FIXED
2. No way to collapse menu on mobile - FIXED
3. Active workers info truncated too aggressively - FIXED

**Solution:**
- Removed redundant Quests/Leaderboard buttons and StatusPill from header
- Added collapsible mobile bottom nav with FAB toggle (persisted to localStorage)
- Improved WorkersSummary truncation: names 80-120px (was 64px), responsive sizing

**Scope:**
- src/components/Layout.tsx - sidebar/nav
- src/components/OverviewDashboard.tsx - header, WorkersSummary
- Responsive breakpoints and mobile interactions
