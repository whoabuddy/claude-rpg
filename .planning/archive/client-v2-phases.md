# Phases

## Phase 1: State Foundation
**Status:** pending
**Goal:** Set up Zustand store with typed slices for all domain data.

### Tasks
- [ ] Install Zustand
- [ ] Create store structure with slices: panes, personas, projects, quests, ui
- [ ] Define TypeScript interfaces aligned with server-v2 types
- [ ] Add devtools middleware for debugging
- [ ] Create selector hooks for components

**Files:** src/store/

---

## Phase 2: WebSocket Integration
**Status:** pending
**Depends on:** Phase 1
**Goal:** Connect WebSocket messages directly to Zustand store.

### Tasks
- [ ] Refactor useWebSocket to update store directly
- [ ] Remove CustomEvent dispatch/listen pattern
- [ ] Handle all server-v2 message types
- [ ] Preserve reconnection logic and backpressure handling
- [ ] Add connection state to store

**Files:** src/lib/websocket.ts, src/store/

---

## Phase 3: Core Components
**Status:** pending
**Depends on:** Phase 2
**Goal:** Migrate core components to use Zustand store.

### Tasks
- [ ] Refactor PaneCard to use store selectors
- [ ] Update OverviewDashboard to read from store
- [ ] Migrate TerminalDisplay with proper memoization
- [ ] Update StatusIndicator components
- [ ] Remove old useWindows, useCompanions hooks

**Files:** src/components/

---

## Phase 4: Pages and Navigation
**Status:** pending
**Depends on:** Phase 3
**Goal:** Update all pages to new data model.

### Tasks
- [ ] Update CompetitionsPage for projects (not companions)
- [ ] Migrate QuestsPage to new quest structure
- [ ] Update ProjectDetailPage
- [ ] Ensure BottomNav works with new routing
- [ ] Add error boundaries per page

**Files:** src/components/*Page.tsx

---

## Phase 5: Polish and Cleanup
**Status:** complete
**Depends on:** Phase 4
**Goal:** Remove legacy code, optimize performance, verify mobile.

### Tasks
- [ ] Remove all CustomEvent code
- [ ] Delete unused hooks and utilities
- [ ] Verify terminal rendering performance
- [ ] Test mobile navigation flow
- [ ] Update CLAUDE.md with new architecture

**Files:** src/, CLAUDE.md
