# Quest: Server V2 Rewrite

**Status:** completed
**Created:** 2026-01-28
**Completed:** 2026-01-28
**Repos:** claude-rpg
**Epic:** #131

## Description

Complete server rewrite for v2 using Bun runtime, SQLite storage, and domain-driven architecture. Fresh rewrite with no migration from v1 - start clean with everything learned.

## Goals

- **All Bun**: Runtime, WebSocket, file ops, SQLite, test runner
- **Domain-driven modules**: tmux/, events/, personas/, projects/, quests/
- **Clear state machines**: Every status has explicit transitions, XState-migration-friendly
- **Comprehensive testing**: XP, quests, parsing, API routes (80%+ coverage)
- **Production-grade**: Graceful shutdown, structured logging, proper error handling

## Key Decisions

- **State machines**: Manual implementation (no XState), migration-friendly design
- **Personas**: Floating employees - session IDs may reuse, many-to-many with projects
- **Storage**: Bun SQLite with proper foreign keys and indices
- **Architecture**: Server is main component, client and LLM are consumers

## Success Criteria

- [x] All 16 server issues completed (#115-#130)
- [x] `bun run server-v2/index.ts` starts cleanly
- [x] SQLite database with migrations
- [x] Test coverage > 80%
- [x] Graceful shutdown works
- [x] WebSocket clients receive real-time updates
- [x] Hook events processed correctly
- [x] Ready for client v2 integration

## Related Issues

#115, #116, #117, #118, #119, #120, #121, #122, #123, #124, #125, #126, #127, #129, #130
