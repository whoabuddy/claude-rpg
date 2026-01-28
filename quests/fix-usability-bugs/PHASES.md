# Phases

## Phase 1: Fix duplicate session names
**Status:** pending
**Issues:** #67
**Goal:** Eliminate name collisions by expanding the name pool to 200+ and adding collision avoidance.

- Expand ENGLISH_NAMES array from ~50 to 200+ unique entries
- Add collision tracking to getSessionName() with fallback to numeric suffix
- Wire active session name set from server/index.ts into the name generator

**Files:** server/companions.ts, server/index.ts

---

## Phase 2: Fix subagent state detection
**Status:** pending
**Issues:** #66
**Goal:** Prevent SubagentStop and subagent notifications from resetting the parent session to "Ready."

- Guard notification handler: do not downgrade from "working" unless terminal shows a prompt
- Ensure subagent_stop does not reset parent state
- Guard session_start so subagent spawns do not reset parent to idle

**Files:** server/index.ts, server/state-reconciler.ts, shared/types.ts

---

## Phase 3: Clean up pane header and action buttons
**Status:** pending
**Issues:** #77 (partial)
**Goal:** Mobile-friendly pane actions: icon-only buttons, fix StatusIndicator alignment, consistent spacing.

- Add iconOnly prop to ActionButton (suppresses label on all breakpoints)
- Fix StatusIndicator vertical alignment to center with action buttons
- Apply icon-only mode to Close/Refresh/Expand in PaneCard and FullScreenPane

**Files:** src/components/ActionButton.tsx, StatusIndicator.tsx, PaneCard.tsx, FullScreenPane.tsx

---

## Phase 4: Clean up window header and top bar
**Status:** pending
**Issues:** #77 (partial)
**Depends on:** Phase 3
**Goal:** Replace cryptic "5W / 8P" stat display, remove redundant "New Claude" button, improve connection panel.

- Replace terse stat format with descriptive text or small icons
- Remove lightning-bolt "New Claude" button from WindowSection (redundant with +Pane)
- Improve StatusPill expand/collapse affordance and clarify dev button state

**Files:** src/components/OverviewDashboard.tsx, StatusPill.tsx

---

## Phase 5: Clean up PaneInput button layout
**Status:** pending
**Issues:** #77 (partial)
**Goal:** Fix Send/Enter/Mic/Interrupt button stacking for consistent layout in card and fullscreen.

- Redesign button row: group primary (Send/Enter) and secondary (Voice, Interrupt) with consistent flex
- Make Interrupt visually secondary when disabled (outline style, not full-width block)
- Compact Enter icon when empty, accent Send when text present

**Files:** src/components/PaneInput.tsx, VoiceButton.tsx

---

## Phase 6: Fix slash command sending
**Status:** pending
**Issues:** #68
**Goal:** Make /clear, /exit, and other slash commands execute when sent from the UI.

- Detect slash-prefixed prompts and send Escape first to dismiss TUI autocomplete
- Add delay between Escape, text entry, and Enter to let TUI settle
- Test with /clear, /exit, /help

**Files:** server/index.ts, server/tmux-batch.ts, src/components/PaneInput.tsx

---

## Phase 7: Make terminal links clickable
**Status:** pending
**Issues:** #78
**Goal:** Detect URLs and file paths in terminal output and make them clickable.

- Create linkifyTerminalContent utility to wrap URLs and file paths in anchor tags
- Add click handler in TerminalDisplay for link navigation
- Ensure linkification does not break ANSI color spans

**Files:** src/utils/linkify.ts (new), src/components/TerminalDisplay.tsx
