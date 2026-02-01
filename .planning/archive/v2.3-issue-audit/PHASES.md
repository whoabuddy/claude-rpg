# v2.3 Issue Audit - Phase Plan

**Quest Goal:** Audit 15 open GitHub issues to determine implementation status. Close implemented issues, consolidate remaining work.

**Created:** 2026-01-30

---

## Phase 1: UI/Header Issues Audit

**Goal:** Audit issues related to header, layout, and static assets.

**Issues:**
- #186 - design: title and subtitle incorrect
- #184 - bug: error accessing manifest.json

### Audit Checklist

**#186 - Title/Subtitle**
- [ ] Check `src/components/Layout.tsx` lines 53-54
- [ ] Current: "tmux tracker / CLAUDE COMPANION"
- [ ] Expected: "claude-rpg / tmux tracker"
- **Finding:** NOT IMPLEMENTED - Layout.tsx shows reversed order

**#184 - manifest.json CORS**
- [ ] Check if `manifest.json` exists in dist
- [ ] Check static serving in `server-v2/api/static.ts`
- [ ] Check Cloudflare Access configuration (external)
- **Finding:** EXTERNAL ISSUE - Cloudflare Access redirecting unauthenticated requests

### Expected Outcomes
- #186: Still needs fix (title ordering)
- #184: Partially external (Cloudflare config) + deprecated meta tag

---

## Phase 2: Persona/Session Persistence Audit

**Goal:** Audit persona creation timing and stability across restarts.

**Issues:**
- #183 - fix: defer persona creation until first hook event

### Audit Checklist

**#183 - Persona Creation Timing**
- [ ] Check `server-v2/personas/service.ts` - `getOrCreatePersona()`
- [ ] Check `server-v2/tmux/session-builder.ts` - persona assignment
- [ ] Check `server-v2/events/handlers.ts` - hook event persona linking
- **Finding:** IMPLEMENTED - Persona creation deferred to first hook event
  - `getOrCreatePersona()` only called from hook handlers (line 41, 69, 107)
  - Session manager links persona on first hook (lines 45-48, 73-77, 109-113)
  - Log message confirms: "Created new persona (from hook event)"

### Expected Outcomes
- #183: CLOSE - Implemented in v2.2

---

## Phase 3: Dashboard/Panel Issues Audit

**Goal:** Audit dashboard components, search/filter, and active workers display.

**Issues:**
- #166 - Dashboard window and panel components
- #164 - Dashboard filter/search bar
- #163 - Active workers

### Audit Checklist

**#166 - Window/Panel Components**
- [ ] Check icon cleanup (pencil, x, + button)
- [ ] Check chevron removal
- [ ] Check "Last" prompt display
- [ ] Check interrupt button
- [ ] Check mobile layout
- **Finding:** PARTIALLY IMPLEMENTED
  - ActionButton component used for actions
  - Interrupt button exists (line 296-304 in PaneCard)
  - Last prompt displayed (line 261-265)
  - Mobile layout still may have issues (needs visual verification)
  - Chevrons still present in multiple places

**#164 - Filter/Search Bar**
- [ ] Check `src/components/OverviewDashboard.tsx` search implementation
- [ ] Check for "/" prefix removal
- [ ] Check placeholder text
- **Finding:** IMPLEMENTED
  - Search box present (lines 240-258)
  - No "/" prefix
  - Placeholder: "Search windows..."
  - Clear button with "x"
  - No keyboard shortcut hints

**#163 - Active Workers**
- [ ] Check `WorkersSummary` component (line 423-517)
- [ ] Check cwd display
- [ ] Check status alignment
- [ ] Check mobile layout
- **Finding:** IMPLEMENTED
  - Full cwd path shown (line 496-498)
  - Grid layout with consistent spacing
  - Name, repo, cwd, activity all displayed
  - Subagent badge included

### Expected Outcomes
- #166: PARTIAL - Some items need visual verification
- #164: CLOSE - Implemented
- #163: CLOSE - Implemented

---

## Phase 4: Leaderboard & Competitions Audit

**Goal:** Audit leaderboard features including time toggles and achievements.

**Issues:**
- #179 - Leaderboard

### Audit Checklist

**#179 - Leaderboard Features**
- [ ] Check default time period
- [ ] Check time period toggles
- [ ] Check achievement tracking display
- [ ] Check 5x/10x badge indicators
- **Finding:** IMPLEMENTED
  - Default period: 'today' (line 34 CompetitionsPage)
  - Time toggles: today/week/all (lines 57-72)
  - AchievementsCard component (lines 153-242)
  - Shows unlocked count, rarity colors
  - Missing: 5x/10x earning count badges

### Expected Outcomes
- #179: MOSTLY DONE - Minor enhancement needed for achievement multipliers

---

## Phase 5: Activity & Status Audit

**Goal:** Audit activity pulse and error state handling.

**Issues:**
- #178 - feat: activity pulse
- #177 - bug: errors too sensitive

### Audit Checklist

**#178 - Activity Pulse**
- [ ] Check `src/components/ActivityPulse.tsx`
- [ ] Check integration in PaneCard/PaneAvatar
- [ ] Check pulse animation trigger
- **Finding:** IMPLEMENTED
  - ActivityPulse component exists with animation
  - Triggers on timestamp change
  - Color-coded by event type (tool/prompt/stop/error)
  - 3-second visibility window

**#177 - Error Sensitivity**
- [ ] Check `server-v2/events/handlers.ts` - error clearing
- [ ] Check `PaneCard.tsx` - error display logic
- [ ] Check error fade/timeout
- **Finding:** IMPLEMENTED
  - `clearError()` called on successful tool use (line 171)
  - `clearError()` called on stop event (line 262)
  - `clearError()` called on new user prompt (line 82)
  - PaneCard has 5-second fade timeout (lines 102-111)
  - Visual dismiss button added (lines 319-324)

### Expected Outcomes
- #178: CLOSE - Implemented
- #177: CLOSE - Implemented

---

## Phase 6: Quests & Data Flow Audit

**Goal:** Audit quests page and data loading.

**Issues:**
- #171 - Quests

### Audit Checklist

**#171 - Quests Page**
- [ ] Check `src/routes/QuestsPage.tsx`
- [ ] Check `src/hooks/useQuests.ts`
- [ ] Check quest API endpoints
- [ ] Check skill reference text
- **Finding:** IMPLEMENTED
  - QuestsPage displays active/paused/completed sections
  - useQuests hook fetches from `/api/quests`
  - API routes defined in `server-v2/api/routes.ts`
  - Empty state text says `/quest "Goal"` (line 100)
  - Note: Actual command is `/quest-create` per new framework

### Expected Outcomes
- #171: MINOR FIX - Update command text from `/quest` to `/quest-create`

---

## Phase 7: Projects & Personas Pages Audit

**Goal:** Audit project detail and persona pages for data issues.

**Issues:**
- #170 - Projects
- #169 - Personas

### Audit Checklist

**#170 - Projects**
- [ ] Check project detail page
- [ ] Check commits/sessions population
- [ ] Check 404 errors
- [ ] Check layout glitch
- **Finding:** NEEDS INVESTIGATION
  - ProjectDetailPage exists but may have API issues
  - TeamStats component mentioned as causing loops
  - Routes exist for `/api/projects/:id`

**#169 - Personas**
- [ ] Check personas page
- [ ] Check energy/morale display
- [ ] Check status consistency
- [ ] Check `/api/personas/:id/challenges` endpoint
- **Finding:** IMPLEMENTED
  - `/api/personas/:id/challenges` route exists (line 35 routes.ts)
  - Health meters computed in persona service
  - PersonaHealth type defined with energy/morale/lastUpdated
  - Challenge system initialized in event handlers

### Expected Outcomes
- #170: NEEDS VERIFICATION - May have remaining bugs
- #169: LIKELY FIXED - API endpoint exists, needs verification

---

## Phase 8: Scratchpad & Notes Audit

**Goal:** Audit scratchpad/notes functionality.

**Issues:**
- #156 - feat: scratchpad for notes

### Audit Checklist

**#156 - Scratchpad**
- [ ] Check `src/routes/ScratchpadPage.tsx`
- [ ] Check voice input integration
- [ ] Check notes CRUD operations
- [ ] Check GitHub issue creation
- **Finding:** IMPLEMENTED
  - Full ScratchpadPage with QuickCapture
  - VoiceButton component for voice input
  - Notes API: GET/POST/PATCH/DELETE
  - CreateIssueModal for GitHub integration
  - Tag suggestions
  - Filter by status (inbox/triaged/archived/converted)

### Expected Outcomes
- #156: CLOSE - Fully implemented

---

## Phase 9: Report API Audit

**Goal:** Audit state/history report endpoint for daily brief.

**Issues:**
- #165 - Feat: report on current state, recent history

### Audit Checklist

**#165 - Report API**
- [ ] Check `server-v2/report/index.ts`
- [ ] Check `/api/report` endpoint
- [ ] Check report structure
- **Finding:** IMPLEMENTED
  - Full DailyReport interface with summary/personas/quests/projects
  - `generateReport()` function with configurable time range
  - `reportToMarkdown()` for LLM consumption
  - API route exists in routes.ts (line 74)

### Expected Outcomes
- #165: CLOSE - Implemented

---

## Phase 10: Deep RPG Integration Audit

**Goal:** Audit remaining RPG features for implementation status.

**Issues:**
- #151 - Deepen RPG integration

### Audit Checklist

**#151 - RPG Features**
- [ ] Persona levels - IMPLEMENTED (personas/service.ts calculateLevel)
- [ ] Badges/traits - IMPLEMENTED (personas/badges.ts checkBadges)
- [ ] Health/morale - IMPLEMENTED (personas/health.ts)
- [ ] Challenges - IMPLEMENTED (personas/challenges.ts)
- [ ] Personality quirks - IMPLEMENTED (personas/personality.ts generatePersonality)
- [ ] Leaderboards - IMPLEMENTED (competitions/index.ts)
- [ ] Project aggregation - IMPLEMENTED (projects/aggregation.ts)
- **Finding:** LARGELY IMPLEMENTED
  - Core RPG systems in place
  - Remaining: visual polish, streak rewards, project heat maps

### Expected Outcomes
- #151: DEFER/ARCHIVE - Core implemented, remaining items are enhancements

---

## Phase 11: Consolidation

**Goal:** Close implemented issues, create consolidated issue for remaining work.

### Actions
1. Close issues confirmed implemented: #183, #164, #163, #178, #177, #156, #165
2. Close/archive large feature complete: #151 (mark as completed with note)
3. Update issues needing minor fixes: #171, #179
4. Investigate and update: #170, #169
5. Create consolidated issue for remaining work:
   - #186 title/subtitle fix
   - #184 manifest.json (document as Cloudflare config)
   - #166 remaining mobile/visual items
   - Any verified bugs from #170, #169

### Consolidated Issue Template
```markdown
## v2.3 Cleanup - Remaining Items

Following the issue audit, these items need attention:

### UI Fixes
- [ ] #186 - Fix header title order: "claude-rpg" should be main title
- [ ] #166 - Mobile layout polish (visual verification needed)
- [ ] Chevron removal on collapsible sections (nice-to-have)

### Documentation
- [ ] #184 - Document Cloudflare Access bypass for manifest.json
- [ ] Update deprecated meta tag

### Minor Fixes
- [ ] #171 - Update quest command text to `/quest-create`
- [ ] #179 - Add achievement earning count badges (5x, 10x)

### Needs Verification
- [ ] #170 - Project detail page data loading
- [ ] #169 - Personas page status/health display
```

---

## Summary

| Issue | Title | Status | Action |
|-------|-------|--------|--------|
| #186 | title incorrect | NOT IMPLEMENTED | Keep open |
| #184 | manifest.json | EXTERNAL | Keep open (document) |
| #183 | defer persona | IMPLEMENTED | CLOSE |
| #179 | leaderboard | MOSTLY DONE | Minor enhancement |
| #178 | activity pulse | IMPLEMENTED | CLOSE |
| #177 | errors sensitive | IMPLEMENTED | CLOSE |
| #171 | quests | IMPLEMENTED | Minor text fix |
| #170 | projects | NEEDS VERIFY | Keep open |
| #169 | personas | LIKELY FIXED | Verify then close |
| #166 | dashboard panels | PARTIAL | Keep open |
| #165 | report API | IMPLEMENTED | CLOSE |
| #164 | filter/search | IMPLEMENTED | CLOSE |
| #163 | active workers | IMPLEMENTED | CLOSE |
| #156 | scratchpad | IMPLEMENTED | CLOSE |
| #151 | RPG integration | MOSTLY DONE | Archive as complete |

**Issues to Close:** 8 (#183, #178, #177, #165, #164, #163, #156, #151)
**Issues to Keep/Update:** 7 (#186, #184, #179, #171, #170, #169, #166)
