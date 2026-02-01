# Quest: Client V2 Rewrite

**Status:** completed
**Created:** 2026-01-28
**Completed:** 2026-01-28
**Repos:** claude-rpg
**Depends on:** Server V2 (completed)

## Description

Modern React client rewrite to consume server-v2 API. Replace CustomEvent pub/sub with Zustand state management, integrate with new personas/projects data model, improve component architecture.

## Goals

- **Zustand state management**: Centralized store for panes, personas, projects, quests
- **Clean WebSocket integration**: Direct store updates instead of CustomEvents
- **Atomic components**: Break down PaneCard, reduce prop drilling
- **Server-v2 API consumption**: New endpoints, new message types
- **Maintain mobile-first**: Keep current responsive design patterns

## Key Decisions

- **State**: Zustand (simple, fast, TypeScript-native)
- **No React Query**: Server pushes state via WebSocket, no polling needed
- **Keep Tailwind**: Current RPG theme works well
- **Incremental migration**: Can keep v1 components during transition

## Success Criteria

- [x] Zustand store managing all state
- [x] WebSocket updates flow directly to store
- [x] All pages working with new data model
- [x] No CustomEvent pub/sub remaining (except toast notifications)
- [x] Terminal display optimized (memoization)
- [x] Mobile navigation preserved
