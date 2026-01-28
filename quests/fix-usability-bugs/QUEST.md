# Quest: Fix All Usability Bugs

**Status:** completed
**Created:** 2026-01-27
**Repos:** claude-rpg

## Description

Fix all open bugs and UI issues that directly affect usability. Covers duplicate session names (#67), subagent state detection (#66), slash command sending (#68), button/icon alignment and layout (#77 partial), and clickable terminal links (#78).

## Success Criteria

- Claude sessions always get unique human names (no duplicates across active sessions)
- Subagent notifications do not reset parent session to "Ready" while still working
- Slash commands (/clear, /exit, etc.) sent from the UI execute correctly
- Pane action buttons are icon-only, properly aligned, with breathing room
- Window header has no redundant buttons, top bar is less cryptic
- PaneInput buttons stack consistently across card and fullscreen modes
- Terminal URLs and file paths are clickable
