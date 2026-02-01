# Phase 3: Consolidate to Single-Screen UI

## Summary

Merge essential features into a single dashboard view. Remove page-based navigation on mobile. Keep desktop sidebar but simplify to Home and Settings only.

## Current State Analysis

### Navigation Structure
- **Desktop sidebar**: Dashboard, Quests, Scratchpad, Settings
- **Mobile bottom nav**: Home, Quests, Notes, Settings (with show/hide toggle)
- **Routes**: /, /quests, /scratchpad, /settings, /projects/:id, /transcribe

### Key Components
- `Layout.tsx`: Contains both desktop sidebar and mobile bottom nav
- `DashboardPage.tsx`: Main dashboard with OverviewDashboard
- `QuestsPage.tsx`: Full quests view with WorkersSummary, QuestCard list, ProjectsSection
- `ScratchpadPage.tsx`: Notes capture with QuickCapture, filter tabs, NoteCard list

### What Users Need on Main Dashboard
1. All Claude panes with status (current OverviewDashboard)
2. Active quests summary (count + current phase)
3. Quick note capture
4. Connection status

## Plan

### Step 1: Create SlidePanel Component
Generic slide-out panel for Quests and Scratchpad content.

Files:
- NEW: `src/components/SlidePanel.tsx`

### Step 2: Create QuestsPanel (extracted from QuestsPage)
Reusable panel that can be embedded in dashboard or shown in slide-out.

Files:
- NEW: `src/components/QuestsPanel.tsx` (move QuestsSection from QuestsPage)

### Step 3: Create ScratchpadPanel (extracted from ScratchpadPage)
Move QuickCapture and note list to reusable panel.

Files:
- NEW: `src/components/ScratchpadPanel.tsx` (move content from ScratchpadPage)

### Step 4: Add Quest Summary to Dashboard Header
Show active quest count with button to open QuestsPanel.

Files:
- EDIT: `src/components/OverviewDashboard.tsx`

### Step 5: Add Quick Capture to Dashboard
Inline collapsed note capture that expands on tap.

Files:
- EDIT: `src/components/OverviewDashboard.tsx`

### Step 6: Update Layout for Single-Screen Mobile
- Remove mobile bottom nav entirely
- Add simple header bar with connection status
- Desktop sidebar keeps only: Home, Settings

Files:
- EDIT: `src/components/Layout.tsx`

### Step 7: Update Routes
- Keep /quests and /scratchpad routes for direct navigation/bookmarks
- But they now render the panels full-screen

Files:
- EDIT: `src/App.tsx`
- EDIT: `src/routes/QuestsPage.tsx`
- EDIT: `src/routes/ScratchpadPage.tsx`

### Step 8: Update DashboardPage
Wire up panel toggles for quests and scratchpad.

Files:
- EDIT: `src/routes/DashboardPage.tsx`

## Acceptance Criteria

- [x] Mobile view shows single screen with all essential info
- [x] Quests and Scratchpad accessible via slide-out panels (not separate pages)
- [x] No bottom tab bar on mobile
- [x] Desktop sidebar simplified to: Home, Settings
- [x] All Claude panes visible on dashboard without scrolling (for typical 2-4 pane setup)

## Commit Sequence (Completed)

1. `feat(ui): add SlidePanel component` - 8be4e65
2. `refactor(quests): extract QuestsPanel from QuestsPage` - d469a92
3. `refactor(scratchpad): extract ScratchpadPanel from ScratchpadPage` - 77ac8b9
4. `feat(dashboard): add inline quests summary and quick capture` - 71da63c
5. `refactor(layout): remove bottom nav, simplify sidebar` - 93f3952
6. `refactor(routes): convert page routes to render panels` - 444107a
