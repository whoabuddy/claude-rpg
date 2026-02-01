# Quest: Mobile-First Responsive Redesign

## Goal

Make claude-rpg web UI the natural home for Claude Code work. Currently at 50% usage (down from 85% in v1) due to layout issues. Target: exceed 85% web UI usage as a drop-in tmux replacement.

## Context

This web UI is a drop-in replacement for using SSH+tmux. The goal is to make it interchangeable - user can work in tmux OR in the web UI, with web UI becoming the natural home.

## Linked Repositories

- `claude-rpg` (this repo)

## Key Issues

1. **Desktop**: Cards have action buttons on a row BELOW status badge - should be single row
2. **Mobile**: Session name shows but cwd/repo gets truncated badly. Buttons don't align.
3. **GitHub buttons**: Currently icon+label - should be icon-only to save space
4. **Touch targets**: StatusIndicator waiting state is 40px height (should be 44px)
5. **Data not surfaced**: lastActivity, tokens, subagent count hidden in compact view

## Guiding Principles

1. **Mobile-first**: 320px minimum width support
2. **Touch-friendly**: 44px minimum interactive targets
3. **Game-inspired**: Clear status, instant recognition, color-coded
4. **Information density**: Essential info visible without scrolling
5. **Desktop enhancement**: Use horizontal space wisely, don't just scale up mobile

## Status

- [x] Phase 1: Fix Touch Targets and Icon-Only Mode
- [x] Phase 2: Mobile-First Compact Card Layout
- [x] Phase 3: Desktop Single-Row Header
- [x] Phase 4: Surface Hidden Data (Tokens, Subagents, Activity)
- [x] Phase 5: Polish and Responsive Testing

Created: 2026-01-31
Completed: 2026-01-31
