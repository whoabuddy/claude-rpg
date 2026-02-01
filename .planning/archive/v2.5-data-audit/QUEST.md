# Quest: Data Tracking & State Machine Audit

## Goal

Audit data tracking, storage, and display systems in claude-rpg to ensure clean state-machine style flows that don't leave sessions in weird states.

## Context

This web UI adds a layer of data and context on top of SSH+tmux. It tracks:
- Tmux windows/panes (polled every 250ms)
- Claude Code hook events (HTTP POST to /event)
- Session status (idle, typing, working, waiting, error)
- XP, companions, quests, achievements (SQLite)

The goal is to use this data to track stats, progress, and display useful information with an RPG-like theme and personas applied to Claude instances.

## Known Issues

1. **State Mismatch**: Agents showing "ready" while terminal shows active work
   - Observed: Status says "Ready" but terminal is updating and Claude is working
   - Hypothesis: Reconciliation logic or timeout values

2. **False Error Display**: Errors displayed for non-actionable chain events
   - Observed: Error shown even though it was part of expected execution chain
   - Hypothesis: No classification of "expected" vs "actionable" errors

## Linked Repositories

- `claude-rpg` (this repo)

## Status

- [x] Phase 1: Data Ingestion Audit (Completed 2026-01-31)
- [x] Phase 2: State Machine Audit (Completed 2026-01-31)
- [x] Phase 3: Error Handling Audit (Completed 2026-01-31)
- [x] Phase 4: Storage and Persistence Audit (Completed 2026-01-31)
- [x] Phase 5: WebSocket and UI Display Audit (Completed 2026-01-31)
- [ ] Phase 6: Open Questions Review (HUMAN CHECKPOINT)

Created: 2026-01-31
