# Quest: Simplify claude-rpg v2

## Goal

Recapture the simplicity of SSH+tmux and the 1.x UI - direct feedback, no ceremony, one screen, text-first. Transform claude-rpg from a feature-heavy RPG dashboard into a focused mobile companion for Claude Code.

## Linked Repositories

- `claude-rpg` (this repo)

## Guiding Principles

1. **Direct feedback like SSH+tmux** - Status visible at a glance
2. **No ceremony** - Just type and go
3. **One screen** - Everything visible without navigation
4. **Text-first** - Content over chrome
5. **Mobile companion focus** - Check Claude from phone

## What to REMOVE

| Feature | Location | Reason |
|---------|----------|--------|
| Personality traits | `server-v2/personas/personality.ts` | Unnecessary complexity, backstories/quirks add no utility |
| Competition categories | `server-v2/competitions/index.ts` | Defer leaderboards; focus on solid stat logging first |
| Leaderboard page | `src/routes/LeaderboardPage.tsx`, `src/components/CompetitionsPage.tsx` | Part of competition removal |
| Multi-page navigation | `src/components/Layout.tsx`, routes | Consolidate to single screen |

## What to KEEP and ENHANCE

| Feature | Location | Notes |
|---------|----------|-------|
| Health meters (energy/morale) | `server-v2/personas/health.ts` | RPG framing, link to moltbook activity |
| Narrative generation | `server-v2/projects/narrative.ts` | Explore and document how it works |
| Tier progression | `server-v2/personas/tiers.ts` | Core RPG framing |
| Moltbook integration | `server-v2/moltbook/` | Activity feed for local AI processes |
| Core functionality | tmux polling, attention alerts, prompts, XP | Essential features |

## Status

- [x] Phase 1: Remove personality traits system
- [x] Phase 2: Remove competitions and leaderboard
- [x] Phase 3: Consolidate to single-screen UI
- [x] Phase 4: Enhance text-first mobile experience
- [ ] Phase 5: Document narrative system
