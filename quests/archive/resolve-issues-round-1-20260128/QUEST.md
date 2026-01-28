# Quest: Claude RPG v2.0 — Complete Feature Release

**Status:** active
**Created:** 2026-01-27
**Repos:** claude-rpg

## Description

Resolve all 21 open issues to produce a complete v2.0 release. Covers notification systems, quest management, competitions, observability, dashboard redesign, navigation, UX polish, and RPG features. This quest uses the plan-execute-verify lifecycle and will be tracked in real-time through the claude-rpg web GUI.

## Success Criteria

- All 21 open GitHub issues resolved and closed
- XP gain and error notifications appear as toasts in the web GUI
- Quest management controls (pause/resume/complete) work from QuestsPage
- Streaks leaderboard tab on CompetitionsPage
- System stats, token usage, and tool duration tracked and displayed
- Dashboard redesigned with "Who's Working on What" view
- Mobile navigation fully functional
- Session and window management from GUI
- Achievements system implemented
- All tests pass, TypeScript clean, production build succeeds
- Release via release-please (conventional commits)

## Issues (21)

| # | Title | Phase |
|---|-------|-------|
| 83 | XP gain and quest XP notifications | 1 |
| 84 | Pane error notifications | 1 |
| 81 | Quest management controls (pause/resume/complete) | 2 |
| 86 | Audit and clean up unused API endpoints | 2 |
| 82 | Streaks leaderboard | 3 |
| 85 | Send prompts to companions directly | 3 |
| 80 | Track basic system stats | 4 |
| 31 | Track token usage from terminal output | 4 |
| 29 | Track tool execution duration | 4 |
| 53 | Revised dashboard display | 5 |
| 36 | Who's Working on What View | 5 |
| 32 | Visualize subagent spawning from Task tool | 5 |
| 59 | Mobile navigation | 6 |
| 54 | Session management | 6 |
| 48 | Window management (create, rename, close) | 6 |
| 62 | Select selected text | 7 |
| 34 | Auto-accept permission bypass warning (opt-in) | 7 |
| 45 | Detect available script from npm | 7 |
| 77 | Design feedback | 7 |
| 52 | Explore RPG relationship with application | 8 |
| 37 | Achievements System | 8 |
