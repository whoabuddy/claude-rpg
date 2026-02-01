# Quest: Fix Terminal Capture and Display Issues

**Status:** Completed
**Created:** 2026-01-31
**Priority:** High

## Goal

Fix terminal capture and display issues identified in code audit to improve reliability of Claude session monitoring.

## Background

An audit of the terminal capture system identified 5 issues affecting reliability:

1. **Hash collision risk** - 32-bit DJB2 hash could miss updates
2. **Backpressure drops** - Documentation says terminal_output is LOW priority (code says HIGH)
3. **50-line limit** - May miss prompts in long output
4. **Full content broadcast** - Bandwidth inefficient
5. **Hardcoded patterns** - Brittle when Claude Code updates

## Success Criteria

- [x] Zero missed terminal updates in 1000-cycle stress test
- [x] 50%+ bandwidth reduction with incremental diffs
- [x] Prompt detection works for all 5 prompt types
- [x] Pattern update procedure documented
- [x] All changes covered by tests

## Linked Repos

- `whoabuddy/claude-rpg` - Main repository

## Phases

See [PHASES.md](./PHASES.md) for detailed breakdown.

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | Complete | Upgrade hash function |
| 2 | Complete | Elevate terminal priority |
| 3 | Complete | Increase capture lines |
| 4 | Complete | Add incremental diffs |
| 5 | Complete | Pattern versioning system |
| 6 | Complete | End-to-end verification |

## Notes

- Phases 1-5 are independent, can be parallelized
- Phase 6 (verification) requires all others complete
- Total estimated time: 7-8 hours
