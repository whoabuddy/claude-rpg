# Phases

## Phase 1: Bun Build Migration
**Status:** completed
**Issues:** #133
**Goal:** Replace Vite with Bun for client build, dev server, and bundling.

### Tasks
- [ ] Create bunfig.toml for client
- [ ] Set up Bun build config (entry, output, minify)
- [ ] Configure dev server with HMR
- [ ] Update package.json scripts
- [ ] Verify production build works
- [ ] Update deploy scripts for Bun build

**Files:** bunfig.toml, package.json, deploy/

---

## Phase 2: React Router Setup
**Status:** completed
**Depends on:** Phase 1
**Issues:** #133, #134
**Goal:** Add React Router for URL-based navigation with lazy loading.

### Tasks
- [ ] Install react-router-dom
- [ ] Create route structure (/, /personas, /projects, /quests, /leaderboard, /settings)
- [ ] Add layout component with navigation
- [ ] Implement lazy loading for route components
- [ ] Update BottomNav to use router links
- [ ] Add 404 handling
- [ ] Preserve query params for filters

**Files:** src/App.tsx, src/routes/, src/components/Layout.tsx

---

## Phase 3: Navigation & Theme Polish
**Status:** pending
**Depends on:** Phase 2
**Issues:** #134, #135
**Goal:** Update navigation, branding, and apply light RPG polish.

### Tasks
- [ ] Design header with logo/branding
- [ ] Add breadcrumb navigation
- [ ] Polish status colors (waiting glow, working pulse)
- [ ] Improve card borders and shadows
- [ ] Add subtle hover/focus effects
- [ ] Update loading spinners to match theme
- [ ] Polish mobile navigation

**Files:** src/components/Layout.tsx, src/styles/, src/components/

---

## Phase 4: Personas View
**Status:** pending
**Depends on:** Phase 3
**Issues:** #137
**Goal:** Create dedicated view for Claude sessions (personas).

### Tasks
- [ ] Create PersonasPage component
- [ ] Show persona cards with avatar, name, status
- [ ] Display session stats (tools used, prompts, XP gained)
- [ ] Add filtering (active, recent, all)
- [ ] Link to associated project
- [ ] Show current activity indicator

**Files:** src/routes/PersonasPage.tsx, src/components/PersonaCard.tsx

---

## Phase 5: Projects View
**Status:** pending
**Depends on:** Phase 3
**Issues:** #138
**Goal:** Create dedicated view for git repositories (projects).

### Tasks
- [ ] Create ProjectsPage component
- [ ] Show project cards with name, level, XP bar
- [ ] Display project stats (commits, tests, deploys)
- [ ] Add streak indicator
- [ ] Show active personas working on project
- [ ] Link to project detail page
- [ ] Add sorting (by level, activity, name)

**Files:** src/routes/ProjectsPage.tsx, src/components/ProjectCard.tsx

---

## Phase 6: Stats Visualization
**Status:** pending
**Depends on:** Phase 5
**Issues:** #136
**Goal:** Add radar charts and progress visualization.

### Tasks
- [ ] Choose/create chart library (recharts or custom SVG)
- [ ] Create RadarChart component for stat distribution
- [ ] Add XP progress bar with level markers
- [ ] Create activity timeline chart
- [ ] Add to project detail page
- [ ] Add to persona detail page

**Files:** src/components/charts/, src/routes/ProjectDetailPage.tsx

---

## Phase 7: Celebrations & Toasts
**Status:** pending
**Depends on:** Phase 6
**Issues:** #145
**Goal:** Add celebration effects for achievements and level-ups.

### Tasks
- [ ] Create CelebrationOverlay component
- [ ] Add confetti/particle effect for level-up
- [ ] Enhance achievement toast with animation
- [ ] Add sound effect hooks (optional, off by default)
- [ ] Create XP gain floating number effect
- [ ] Test on mobile (performance)

**Files:** src/components/Celebration.tsx, src/components/ToastContainer.tsx

---

## Phase 8: Dashboard Redesign
**Status:** pending
**Depends on:** Phase 7
**Issues:** #142
**Goal:** Redesign main dashboard with improved pane grid.

### Tasks
- [ ] Create responsive pane grid layout
- [ ] Add quick stats summary bar
- [ ] Show attention-needed panes prominently
- [ ] Add recent activity feed
- [ ] Improve window grouping visuals
- [ ] Add keyboard shortcuts hint

**Files:** src/routes/DashboardPage.tsx, src/components/PaneGrid.tsx

---

## Phase 9: Test Infrastructure
**Status:** pending
**Depends on:** Phase 1
**Issues:** #144
**Goal:** Set up Bun test runner for client components.

### Tasks
- [ ] Configure Bun test for React
- [ ] Set up jsdom or happy-dom for DOM testing
- [ ] Create test utilities and helpers
- [ ] Write tests for store selectors
- [ ] Write tests for key components
- [ ] Add to CI pipeline

**Files:** src/__tests__/, bunfig.toml

---

## Phase 10: Integration & Polish
**Status:** completed
**Depends on:** All previous phases
**Issues:** #147, #148, #149
**Goal:** Final integration, settings page, mobile features, close all issues.

### Tasks
- [ ] Create SettingsPage (theme, notifications, sounds)
- [ ] Add PWA manifest and service worker
- [ ] Test all routes on mobile
- [ ] Verify WebSocket reconnection with router
- [ ] Performance audit and fixes
- [ ] Close all v2 client issues
- [ ] Update CLAUDE.md

**Files:** src/routes/SettingsPage.tsx, public/manifest.json
