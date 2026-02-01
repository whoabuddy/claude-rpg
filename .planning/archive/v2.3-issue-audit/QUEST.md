# Quest: Issue Audit v2.3

Audit each open issue in claude-rpg to determine if it's already implemented. Close implemented issues, aggregate remaining work into a consolidated issue.

## Status

**Created:** 2026-01-30
**Completed:** 2026-01-30
**Status:** completed

## Summary

15 open issues to audit from previous v2.2 quest completion.

### Issues to Close (8 - Fully Implemented)

| Issue | Title | Evidence |
|-------|-------|----------|
| #183 | defer persona creation | Persona creation only from hook handlers |
| #178 | activity pulse | `ActivityPulse.tsx` with animation |
| #177 | errors too sensitive | `clearError()` on success, 5s fade |
| #165 | report API | Full `DailyReport` with `generateReport()` |
| #164 | filter/search | No "/" prefix, "Search windows..." placeholder |
| #163 | active workers | Full cwd, grid layout, spacing |
| #156 | scratchpad | Full page with voice, CRUD, GitHub issue creation |
| #151 | RPG integration | Levels, badges, health, challenges implemented |

### Issues Needing Minor Fixes (3)

| Issue | Title | Remaining Work |
|-------|-------|----------------|
| #179 | leaderboard | Add 5x/10x earning count badges |
| #171 | quests | Update `/quest` to `/quest-create` |
| #166 | dashboard panels | Mobile polish, chevron removal |

### Issues to Keep Open (4)

| Issue | Title | Reason |
|-------|-------|--------|
| #186 | title incorrect | Shows "tmux tracker / CLAUDE COMPANION" |
| #184 | manifest.json | Cloudflare Access CORS + deprecated meta |
| #170 | projects | Needs visual verification |
| #169 | personas | Status display needs verification |

## Linked Repos

- claude-rpg (primary)

## Success Criteria

- 8 implemented issues closed with audit comments
- Visual verification of #169, #170
- Consolidated issue created for remaining work
- #186 fixed (simple text change)
