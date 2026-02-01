# Phase 4: Enhance text-first mobile experience

## Goal
Strip visual chrome, maximize information density, text-first design. Direct like a terminal - content over decoration.

## Changes Required

### 1. Remove CelebrationOverlay
- Delete `src/components/CelebrationOverlay.tsx`
- Remove import and usage from `src/components/Layout.tsx`
- XP notifications already go through toast system (see comment in file)

### 2. Remove RadarChart
- Delete `src/components/RadarChart.tsx`
- Update `src/components/ProjectDetailPage.tsx` to replace radar chart with text-based stats list

### 3. Simplify StatusIndicator
- Keep the color-coded status text label
- Remove the colored dot indicator (redundant with text)
- Maintain dismiss button for waiting state

### 4. Simplify PaneCard
- Reduce padding from p-3 to p-2
- In compact mode: show status text, repo/worker name, no expand arrow indicator
- In expanded mode: reduce header padding
- Increase terminal visibility (currently max-h-64, could make it larger)
- Remove SessionStatsBar from expanded view (stats in project detail page only)

### 5. Reduce global padding
- In `src/styles/index.css` and via Tailwind adjustments in components
- Already using p-2/p-3 in most places - focus on consistency

### 6. Improve terminal display density
- Reduce padding in TerminalDisplay from p-3 to p-2
- Consider removing border for cleaner look

## Acceptance Criteria
- [x] PaneCard shows: worker name, status word, repo name, last 3 terminal lines
- [x] No radar charts in UI
- [x] No celebration animations
- [x] Touch targets remain 44px+ but visual padding is minimal
- [x] Mobile viewport shows 3+ panes without scrolling

## Implementation Order
1. Delete CelebrationOverlay and update Layout
2. Delete RadarChart and update ProjectDetailPage
3. Simplify StatusIndicator
4. Compact PaneCard
5. Optimize TerminalDisplay

## Notes
- Celebration animations are already unused (see comment: events never dispatched)
- RadarChart is only used in ProjectDetailPage
- Keep ActionButton touch targets at minimum 44px for accessibility
