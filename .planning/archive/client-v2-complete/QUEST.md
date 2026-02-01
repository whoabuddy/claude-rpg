# Quest: Client V2 Complete

**Status:** active
**Created:** 2026-01-28
**Repos:** claude-rpg
**Epic:** #150
**Depends on:** Server V2 (completed), Client State Management (completed)

## Description

Complete the client v2 rewrite: Bun build tooling, React Router navigation, Personas/Projects views, stats visualization, celebrations, and test infrastructure. Light RPG polish now, full redesign documented for future.

## Goals

- **Bun-first**: Replace Vite with Bun for build/dev/test
- **React Router**: URL-based navigation with deep linking
- **Personas + Projects**: Separate views matching server-v2 data model
- **Stats visualization**: Radar charts, progress graphs
- **Celebrations**: Level-up effects, achievement toasts
- **Test infrastructure**: Bun test runner for client
- **Light RPG polish**: Better colors, status indicators, subtle effects

## Key Decisions

- **Build**: Bun (match server-v2 stack)
- **Routing**: React Router v6 with lazy loading
- **State**: Keep Zustand (already done)
- **Charts**: Lightweight library (recharts or custom SVG)
- **Theme**: Polish existing Tailwind, don't full redesign yet

## Success Criteria

- [ ] Bun builds client successfully
- [ ] React Router handles all navigation
- [ ] Personas view shows Claude sessions
- [ ] Projects view shows git repos with stats
- [ ] Radar/progress charts render
- [ ] Level-up and achievement celebrations work
- [ ] Tests pass with Bun test runner
- [ ] All #133-#149 issues closeable

## Future Ideas (Full RPG Redesign)

For a future quest, consider:
- WoW/StarCraft inspired UI chrome (borders, frames, fonts)
- Character portrait frames with level badges
- Animated skill trees for progression
- Sound effects for achievements
- Custom cursor and hover effects
- Particle effects on major events
- Dark/light RPG theme variants
