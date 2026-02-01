# Phase 5: Improve Mobile UX and Layout

## Goal
Clean up redundant UI elements and improve mobile experience

## Problems Identified

### 1. Top bar duplicates side menu functionality (CONFIRMED)
**Finding:** OverviewDashboard has header with:
- Stats (windows/panes counts)
- Attention badges
- New Window, Expand/Collapse All buttons
- Quests/Leaderboard navigation buttons (desktop only)
- Status pill

**Issue:** The Quests/Leaderboard buttons in header (lines 236-241) duplicate the sidebar navigation. Status pill duplicates connection info shown in sidebar footer.

### 2. No way to collapse menu on mobile (CONFIRMED)
**Finding:** Layout.tsx shows:
- Desktop: permanent sidebar (hidden sm:flex) - no collapse mechanism
- Mobile: fixed bottom nav bar - no way to hide it for more screen space

**Issue:** On mobile, bottom nav is always visible (fixed position), taking up valuable vertical space. No hamburger menu or collapse option.

### 3. Active workers info truncated too aggressively (CONFIRMED)
**Finding:** WorkersSummary component (lines 444-552) shows:
- Name: `w-16 flex-shrink-0` (64px fixed width, truncated)
- Repo: `max-w-[120px] flex-shrink-0` (120px max, truncated)
- Activity: `truncate flex-1 min-w-0` (fills remaining space, truncated)

**Issue:** Name truncated at 64px is too aggressive. Modern names like "Alexander" or "Charlotte" get cut. Should allow more space, especially on desktop.

## Tasks

### Task 1: Remove redundant header elements
**Files:** `src/components/OverviewDashboard.tsx`

**Action:**
1. Remove Quests/Leaderboard navigation buttons from header (lines 236-241) - sidebar already has these
2. Remove StatusPill from header (line 242) - connection info shown in sidebar footer
3. Keep essential header elements: stats, attention badge, action buttons (New Window, Expand/Collapse)

**Verify:**
```bash
npm run build
# Manual: Check that header is cleaner, nav doesn't duplicate sidebar
```

### Task 2: Improve WorkersSummary truncation
**Files:** `src/components/OverviewDashboard.tsx`

**Action:**
1. Change name width from `w-16` (64px) to `min-w-[80px] max-w-[120px]` - allow more space, truncate only if needed
2. On mobile (sm: breakpoint), reduce repo max-width from 120px to 100px to balance space
3. Add responsive activity width: give more space on larger screens

**Changes:**
- Line 516-517: Name styling - increase from w-16 to flexible width
- Line 520-521: Repo styling - add mobile-specific max-width
- Line 524-525: Activity styling - optimize for responsive layout

**Verify:**
```bash
npm run build
# Manual: Check that names display fully unless very long, activity shows more context
```

### Task 3: Add mobile menu collapse functionality
**Files:** `src/components/Layout.tsx`

**Action:**
1. Add state for mobile menu visibility (collapsed by default)
2. Add hamburger menu button to toggle bottom nav
3. When collapsed, hide bottom nav and add floating action button (FAB) to reopen
4. Add slide-up/slide-down animation for smooth UX
5. Persist preference in localStorage

**Changes:**
- Add useState for `mobileMenuOpen` (default: true for existing behavior)
- Add FAB component (fixed bottom-right) shown when menu hidden
- Add CSS transitions for slide-up/down
- Update bottom nav to use `translate-y-full` when collapsed
- Add localStorage sync

**Verify:**
```bash
npm run build
# Manual: On mobile, tap hamburger to hide/show bottom nav. Check FAB appears when hidden.
```

## Success Criteria

1. Header is cleaner - no duplicate navigation or status elements
2. WorkersSummary shows full names unless truly long
3. Mobile bottom nav can be collapsed for more screen space
4. FAB provides easy access to reopen menu
5. All existing functionality remains intact

## Files to Modify

- `src/components/OverviewDashboard.tsx` - Tasks 1 & 2
- `src/components/Layout.tsx` - Task 3
- `src/styles/index.css` - Task 3 (animations if needed)
