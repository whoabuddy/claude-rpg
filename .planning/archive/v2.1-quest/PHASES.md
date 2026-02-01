# Phases: Claude RPG v2.1 - Complete Remaining Features

## Phase 1: Add audio file transcription page

**Status:** completed

**Goal:** Allow users to upload an audio file and receive transcribed text, exposed as a standalone page.

**Issues:** #153 (full)

**Key Tasks:**
1. Port whisper.ts transcription logic to server-v2
2. Add `/api/transcribe` POST endpoint to routes (accepts file upload)
3. Create TranscribePage.tsx with drag-drop upload UI
4. Add route to App.tsx router

**Files Likely Affected:**
- `server-v2/lib/whisper.ts` (new)
- `server-v2/api/routes.ts`
- `server-v2/api/handlers.ts`
- `src/routes/TranscribePage.tsx` (new)
- `src/App.tsx`

**Dependencies:** None

---

## Phase 2: Add GitHub repo clone endpoint

**Status:** completed

**Goal:** Accept a GitHub URL and clone the repo to ~/dev/org/repo/ structure automatically.

**Issues:** #154 (full)

**Key Tasks:**
1. Create clone utility with URL parsing and validation
2. Add `/api/clone` POST endpoint
3. Handle edge cases: existing repos, forks, private repos (with gh auth)
4. Return success with path or error message

**Files Likely Affected:**
- `server-v2/projects/clone.ts` (new)
- `server-v2/api/routes.ts`
- `server-v2/api/handlers.ts`

**Dependencies:** None

---

## Phase 3: Add scratchpad foundation

**Status:** completed

**Goal:** Basic scratchpad storage and simple UI for quick text capture and review.

**Issues:** #156 (partial)

**Key Tasks:**
1. Add `notes` table to database schema (id, content, created_at, tags, status)
2. Add CRUD endpoints: GET/POST `/api/notes`, PATCH/DELETE `/api/notes/:id`
3. Create ScratchpadPage.tsx with note list and text input
4. Add route to App.tsx

**Files Likely Affected:**
- `server-v2/db/schema.ts`
- `server-v2/db/migrations.ts`
- `server-v2/db/queries.ts`
- `server-v2/api/routes.ts`
- `server-v2/api/handlers.ts`
- `src/routes/ScratchpadPage.tsx` (new)
- `src/App.tsx`

**Dependencies:** None

---

## Phase 4: Deepen persona progression

**Status:** completed

**Goal:** Add progression tiers, auto-assigned specialization badges, and personality traits to personas.

**Issues:** #151 (partial: tiers, badges, traits)

**Key Tasks:**
1. Define tier thresholds and names (e.g., Novice, Apprentice, Journeyman, Expert, Master)
2. Create specialization badge system based on tool usage patterns (e.g., "Code Architect", "Test Champion", "Git Master")
3. Add personality quirks/backstory blurbs that unlock at milestones
4. Update Persona type and database schema with new fields
5. Update PersonasPage to display tiers, badges, and personality

**Files Likely Affected:**
- `server-v2/personas/types.ts`
- `server-v2/personas/tiers.ts` (new)
- `server-v2/personas/badges.ts` (new)
- `server-v2/personas/personality.ts` (new)
- `server-v2/personas/service.ts`
- `server-v2/db/schema.ts`
- `server-v2/db/migrations.ts`
- `shared/types.ts`
- `src/routes/PersonasPage.tsx`
- `src/components/PersonaBadges.tsx` (new)

**Dependencies:** None (builds on existing persona system)

---

## Phase 5: Add persona health and challenges

**Status:** completed

**Goal:** Add health/morale meters and daily/weekly personal challenges for personas.

**Issues:** #151 (partial: health/morale, challenges)

**Key Tasks:**
1. Design health/morale system (affected by: errors, long sessions, successes, breaks)
2. Add health/morale fields to persona schema
3. Create challenge definitions (daily: "Run 3 tests", weekly: "Complete a quest")
4. Add challenge assignment and tracking logic
5. Update PersonasPage with health bars and active challenges

**Files Likely Affected:**
- `server-v2/personas/types.ts`
- `server-v2/personas/health.ts` (new)
- `server-v2/personas/challenges.ts` (new)
- `server-v2/personas/service.ts`
- `server-v2/db/schema.ts`
- `server-v2/db/migrations.ts`
- `src/routes/PersonasPage.tsx`
- `src/components/HealthMeter.tsx` (new)
- `src/components/ChallengeCard.tsx` (new)

**Dependencies:** Phase 4 (persona progression system)

---

## Phase 6: Complete scratchpad workflow

**Status:** completed

**Goal:** Add voice input, triage workflow, and optional GitHub issue integration to scratchpad.

**Issues:** #156 (complete)

**Key Tasks:**
1. Add voice recording to scratchpad (reuse VoiceButton + transcribe endpoint)
2. Add triage workflow: inbox -> review -> action (archive, create issue, assign tag)
3. Add status field to notes (inbox, triaged, archived, converted)
4. Add optional "Create GitHub Issue" action using gh CLI
5. Enhance ScratchpadPage with filters and action buttons

**Files Likely Affected:**
- `server-v2/db/schema.ts` (status field)
- `server-v2/api/handlers.ts` (triage actions)
- `server-v2/api/routes.ts`
- `src/routes/ScratchpadPage.tsx`
- `src/components/NoteCard.tsx` (new)
- `src/components/TriageActions.tsx` (new)

**Dependencies:** Phase 1 (transcription), Phase 3 (scratchpad foundation)

---

## Phase 7: Add project aggregation and narrative

**Status:** completed

**Goal:** Add project-level aggregation (team stats), team leaderboard, and narrative summary generator with export.

**Issues:** #151 (complete)

**Key Tasks:**
1. Add project aggregation: sum XP across all personas working on project
2. Create team leaderboard view (projects ranked by total XP, commits, etc.)
3. Build narrative summary generator (turn stats into story-like text)
4. Add `/api/narrative/:projectId` export endpoint (markdown/JSON)
5. Update ProjectDetailPage with team stats and narrative section

**Files Likely Affected:**
- `server-v2/projects/aggregation.ts` (new)
- `server-v2/projects/narrative.ts` (new)
- `server-v2/api/routes.ts`
- `server-v2/api/handlers.ts`
- `src/routes/ProjectDetailPage.tsx`
- `src/routes/LeaderboardPage.tsx`
- `src/components/NarrativeSummary.tsx` (new)
- `src/components/TeamStats.tsx` (new)

**Dependencies:** Phase 4 (persona progression for richer narratives)

---

## Summary

| Phase | Name | Issues | Est. Size | Dependencies |
|-------|------|--------|-----------|--------------|
| 1 | Audio file transcription | #153 | Small | None |
| 2 | GitHub repo clone | #154 | Small | None |
| 3 | Scratchpad foundation | #156 | Small | None |
| 4 | Persona progression | #151 | Medium | None |
| 5 | Health and challenges | #151 | Medium | Phase 4 |
| 6 | Scratchpad workflow | #156 | Medium | Phase 1, 3 |
| 7 | Project aggregation | #151 | Medium | Phase 4 |

Phases 1-3 can be done in parallel. Phases 4-7 have dependencies and should be sequential.
