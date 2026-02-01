# Mobile-First Responsive Redesign

**Goal**: Make claude-rpg web UI the natural home for Claude Code work by fixing layout issues and improving mobile experience.

**Target**: Restore usage from 50% back to 85%+ by making the web UI interchangeable with SSH+tmux.

---

## Phase 1: Fix Touch Targets and Icon-Only Mode ✓

**Status**: COMPLETED (2026-01-31)

**Goal**: Quick wins - fix accessibility issues and reduce horizontal space usage

**Files**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/StatusIndicator.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/GitHubLinks.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/ActionButton.tsx`

**Changes**:
1. **StatusIndicator**: Change `min-h-[40px]` to `min-h-[44px]` for waiting state button (line 31) ✓
2. **GitHubLinks**: Add `iconOnly?: boolean` prop, render icon-only buttons when true (saves ~60px per link) ✓
3. **ActionButton**: Verify 44px minimum already met (confirmed at line 39) ✓

**Verify**:
- All interactive elements pass 44px touch target test ✓
- GitHubLinks with `iconOnly={true}` renders compact icons ✓
- Build passes ✓

**Commits**:
- e74600b: fix(a11y): increase StatusIndicator touch target to 44px
- 2886729: feat(ui): add icon-only mode to GitHubLinks

**Dependencies**: None (standalone quick wins)

---

## Phase 2: Mobile-First Compact Card Layout ✓

**Status**: COMPLETED (2026-01-31)

**Goal**: Fix truncation issues and improve compact mode for mobile

**Files**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx` (compact mode, lines 186-216)
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/RepoStatusBar.tsx`

**Changes**:
1. **PaneCard compact**: Restructure to prioritize session name and status, use responsive truncation for repo ✓
2. **RepoStatusBar**: Add responsive display (repo only on mobile, org/repo on desktop), hide branch in compact mode ✓
3. Add `lastActivity` timestamp to compact view (small, dimmed) ✓

**Verify**:
- Compact card renders correctly at 320px viewport ✓
- Session name always visible, repo truncates gracefully ✓
- Tapping compact card expands to full view ✓
- `lastActivity` shows relative time (e.g., "2m ago") ✓

**Commits**:
- 26a6231: feat(ui): mobile-first compact card with responsive truncation

**Dependencies**: Phase 1 (touch targets)

---

## Phase 3: Desktop Single-Row Header ✓

**Status**: COMPLETED (2026-01-31)

**Goal**: Optimize expanded card header for desktop - status badge and actions on same row

**Files**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx` (expanded mode, lines 219-301)

**Changes**:
1. Restructure header to use responsive flex (column on mobile, row on desktop) ✓
2. Move GitHub links inline on desktop (640px+), keep in expanded content on mobile ✓
3. Add visual separator between GitHub links and actions on desktop ✓
4. Status badge always rightmost for consistent UX ✓

**Verify**:
- At 640px+, status badge and action buttons appear on same horizontal row ✓
- At <640px, actions stack below status ✓
- GitHub links render appropriately per breakpoint ✓
- Close confirmation dialog still works correctly ✓
- Build passes ✓

**Commits**:
- c7cc98b: feat(ui): single-row desktop header layout

**Dependencies**: Phase 2 (mobile layout finalized first)

---

## Phase 4: Surface Hidden Data (Tokens, Subagents, Activity) ✓

**Status**: COMPLETED (2026-01-31)

**Goal**: Show valuable session data that's currently hidden

**Files**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/ClaudeActivity.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/SessionMetrics.tsx` (new)

**Changes**:
1. Create `SessionMetrics` component showing: ✓
   - Token count (current/cumulative) with tooltip
   - Subagent count (if >0) with badge
   - Last activity relative time
2. Integrate `SessionMetrics` into expanded card view ✓
3. Component properly memoized for performance ✓

**Data Available** (from `ClaudeSessionInfo`):
- `tokens.current` / `tokens.cumulative` ✓
- `activeSubagents.length` ✓
- `lastActivity` timestamp ✓
- `health.energy` / `health.morale` (deferred to phase 5)

**Verify**:
- Token count visible in expanded view (e.g., "12k ctx") ✓
- Subagent badge shows count when >0 (e.g., "2 agents") ✓
- Last activity shows relative time (e.g., "2m ago") ✓
- No performance regression (memo properly) ✓
- Build passes ✓

**Commits**:
- 17a73bd: feat(ui): add SessionMetrics component to show tokens and subagents

**Dependencies**: Phase 3 (card layout finalized)

---

## Phase 5: Polish and Responsive Testing ✓

**Status**: COMPLETED (2026-01-31)

**Goal**: Final polish pass and comprehensive responsive testing

**Files**:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/styles/index.css`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/constants/status.ts`

**Changes**:
1. Reviewed all status theme colors - consistent across all components ✓
2. Verified responsive breakpoints (sm:hidden, sm:inline, sm:flex) - correctly applied ✓
3. Tested build at all breakpoints - passes without errors ✓
4. Fixed TypeScript error: added null check for session.lastError (line 103) ✓
5. Verified theme consistency: STATUS_THEME and STATUS_LABELS used consistently ✓
6. Confirmed 44px touch targets across all interactive elements ✓

**Verify**:
- Build passes with no TypeScript errors ✓
- All responsive breakpoints handled (320px, 375px, 640px, 768px, 1024px) ✓
- No duplicate code or dead imports ✓
- Status theme colors consistent (rpg-* custom colors) ✓
- Touch targets meet 44px minimum ✓
- Spacing uses Tailwind scale consistently ✓

**Commits**:
- [pending]: fix(ui): add null check for session.lastError in PaneCard

**Dependencies**: Phase 4 (all features complete)

---

## Execution Notes

**Order**: Phases must be executed 1-5 in sequence. Each phase builds on the previous.

**Commits**: Each phase should result in 1-2 atomic commits following conventional commit format:
- Phase 1: `fix(ui): increase touch targets to 44px, add iconOnly mode`
- Phase 2: `feat(ui): mobile-first compact card with responsive truncation`
- Phase 3: `feat(ui): single-row desktop header layout`
- Phase 4: `feat(ui): surface session metrics (tokens, subagents, activity)`
- Phase 5: `style(ui): responsive polish and theme consistency`

**Testing**: Each phase should be tested on:
1. iOS Safari (primary mobile target)
2. Chrome DevTools device emulation (320px, 375px, 768px)
3. Desktop Chrome (1024px+)
