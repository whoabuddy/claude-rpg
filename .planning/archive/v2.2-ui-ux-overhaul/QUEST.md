# Quest: Claude RPG UI/UX Overhaul

## Goal

Fix all broken UI features and make the app fully-functional and amazing as an enhanced, powerful, fun view of work being done through tmux + tools like Claude.

## Status

**Created:** 2026-01-30
**Completed:** 2026-01-30
**Status:** completed

## Issues to Fix

### Critical Bugs
1. **Avatars not loading** - Showing letters instead of Bitcoin Faces (main view + Personas tab)
2. **Personas showing "offline"** - All 5 show offline even though they're active Claude instances

### Data/Display Issues
3. **Quests tab empty** - Should show active quests from .planning/ directories
4. **Leaderboard empty and mislabeled** - Says "competitions" but should be "Leaderboard"

### UX Improvements
5. **Random names not relatable** - "Frost Mist", "Radiant Dragon" don't mean anything
6. **Top bar redundant** - Duplicates side menu functionality
7. **Mobile UX** - Need collapsible menu for mobile interaction
8. **Active workers truncated** - Should show full info, only truncate when necessary

## Repository

- `whoabuddy/claude-rpg` (primary)

## Success Criteria

1. Bitcoin Face avatars load and display correctly
2. Personas show correct status (idle/working/waiting)
3. Quests tab shows active quests from .planning/ directories
4. Leaderboard displays companion rankings properly
5. Names are more relatable/memorable
6. Mobile-friendly with collapsible navigation
7. No redundant UI elements
8. Worker info displays fully unless truncation is needed
