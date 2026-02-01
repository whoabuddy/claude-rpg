# Quest: v2.2 Issue Cleanup

Close all 15 v2 open issues - fix bugs, implement combined Personas/Projects/Quests page, standardize UI/layout, complete RPG features.

## Status

**Created:** 2026-01-30
**Completed:** 2026-01-30
**Status:** completed

## Issues Breakdown

### Critical Bugs (4 issues)
- #183 - Persona names change on server restart
- #177 - Error panel too sensitive (persists after success)
- #169/#170 - 404s on `/api/personas/:id/challenges` (symptom of #183)
- #171 - Quests not loading

### UI/Layout Standardization (5 issues)
- #172 - Consistent layout and navigation
- #167 - Menu and Settings improvements
- #166 - Dashboard window/panel cleanup
- #164 - Dashboard filter/search bar cleanup
- #163 - Active workers layout fixes

### Page Consolidation (3 issues -> 1 unified page)
- #169 - Personas page issues
- #170 - Projects page issues
- #171 - Quests page issues

### Leaderboard (1 issue)
- #179 - Default to today, time toggles, persona/achievement links

### Features (3 issues)
- #178 - Activity pulse visual heartbeat
- #156 - Scratchpad for notes
- #165 - State/history report endpoint

### Deferred (1 issue)
- #151 - Deepen RPG integration (too large for this quest)

## Key Insight

The 404 errors on `/api/personas/:id/challenges` are a SYMPTOM of #183. When the server restarts, new UUIDs are generated for personas because they're created eagerly on tmux polling rather than waiting for the first hook event. The frontend caches the old persona IDs, so API calls fail.

**Fix:** Defer persona creation until the first hook event arrives (which includes the stable sessionId).

## Linked Repos

- claude-rpg (primary)

## Success Criteria

- All 15 issues closed (except #151 deferred)
- CI passing
- No console errors in production
- Mobile and desktop layouts work correctly
