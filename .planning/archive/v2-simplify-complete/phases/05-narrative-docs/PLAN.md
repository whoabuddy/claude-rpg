# Phase 5: Document and Preserve Narrative System

## Objective
Document how narrative generation works before further simplification. Ensure it remains functional for project detail views.

## Analysis Summary

### Files Examined
- `server-v2/projects/narrative.ts` - Pure functions for generating story-like summaries
- `server-v2/projects/aggregation.ts` - Database aggregation for TeamStats
- `server-v2/api/handlers.ts` - getProjectNarrative handler (lines 346-389)
- `src/components/ProjectDetailPage.tsx` - Already displays narrative
- `src/components/NarrativeSummary.tsx` - Collapsible sections UI
- `src/lib/api.ts` - getProjectNarrative client function
- `src/types/project.ts` - Client-side type definitions

### Current Architecture
1. **Data Flow**: XP events -> aggregation.ts -> TeamStats -> narrative.ts -> NarrativeSummary
2. **API Endpoint**: GET /api/projects/:id/narrative?format=json|markdown
3. **UI Display**: ProjectDetailPage fetches and renders NarrativeSummary component

### Key Findings
- Narrative is already displayed in ProjectDetailPage (acceptance criterion met)
- System is well-structured with pure functions (easy to test)
- TeamStats aggregates from xp_events table
- No tests exist for narrative or aggregation modules

## Tasks

### Task 1: Add Narrative System Documentation to CLAUDE.md
- Add section explaining the narrative generation pipeline
- Document the data flow from XP events to story text
- Reference the key files and their responsibilities

### Task 2: Write Integration Test for Narrative Generation
Create `server-v2/__tests__/narrative.test.ts`:
- Test empty project (no XP events)
- Test single contributor scenario
- Test multiple contributors scenario
- Test various edge cases (no commits, only tools, etc.)

### Task 3: Verify Narrative Endpoint Functions
- Ensure GET /api/projects/:id/narrative returns valid response
- Both json and markdown formats

## Acceptance Criteria Status
- [x] Documentation exists explaining narrative generation algorithm
- [ ] GET /api/projects/:id/narrative returns valid response (to verify)
- [ ] Test covers: empty project, single contributor, multiple contributors
- [x] ProjectDetailPage displays narrative summary (already implemented)

## Implementation Order
1. Write the test file first (helps verify understanding)
2. Run tests to verify they pass
3. Add documentation to CLAUDE.md
4. Update STATE.md and PHASES.md
