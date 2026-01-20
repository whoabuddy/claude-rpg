#!/bin/bash
# Claude RPG Hook Script
# Captures Claude Code events and forwards them to the Claude RPG server

set -e

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════

DATA_DIR="${CLAUDE_RPG_DATA_DIR:-$HOME/.claude-rpg/data}"
SERVER_URL="${CLAUDE_RPG_SERVER:-http://localhost:4011}"
EVENTS_FILE="$DATA_DIR/events.jsonl"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# ═══════════════════════════════════════════════════════════════════════════
# Find tools (defensive, works on macOS and Linux)
# ═══════════════════════════════════════════════════════════════════════════

# Add common paths
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

find_tool() {
  local tool="$1"
  if command -v "$tool" &>/dev/null; then
    command -v "$tool"
    return 0
  fi
  for dir in /opt/homebrew/bin /usr/local/bin /usr/bin "$HOME/.local/bin"; do
    if [[ -x "$dir/$tool" ]]; then
      echo "$dir/$tool"
      return 0
    fi
  done
  return 1
}

JQ=$(find_tool jq) || { echo "jq not found" >&2; exit 1; }
CURL=$(find_tool curl) || CURL=""

# ═══════════════════════════════════════════════════════════════════════════
# Generate timestamp (handles macOS lack of %N)
# ═══════════════════════════════════════════════════════════════════════════

get_timestamp_ms() {
  if date +%s%3N 2>/dev/null | grep -qE '^[0-9]+$'; then
    date +%s%3N
  else
    # macOS fallback
    local sec=$(date +%s)
    local ms=$(perl -MTime::HiRes=time -e 'printf "%03d", (time * 1000) % 1000' 2>/dev/null || echo "000")
    echo "${sec}${ms}"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# Main: Process event
# ═══════════════════════════════════════════════════════════════════════════

# Read event from stdin
EVENT=$(cat)
HOOK_TYPE="${1:-unknown}"

# Get tmux target and pane ID if available
# Use $TMUX_PANE env var directly (more reliable than tmux commands)
TMUX_TARGET=""
PANE_ID=""
if [[ -n "$TMUX_PANE" ]]; then
  PANE_ID="$TMUX_PANE"
  # Get target in session:window_index.pane_index format (must match polling format)
  TMUX_TARGET=$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null || echo "")
elif [[ -n "$TMUX" ]]; then
  # Fallback to display-message without target
  TMUX_TARGET=$(tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null || echo "")
  PANE_ID=$(tmux display-message -p '#{pane_id}' 2>/dev/null || echo "")
fi

# Generate timestamp
TIMESTAMP=$(get_timestamp_ms)

# Enhance event with metadata
ENHANCED=$("$JQ" -c \
  --arg hook "$HOOK_TYPE" \
  --arg ts "$TIMESTAMP" \
  --arg tmux "$TMUX_TARGET" \
  --arg pane "$PANE_ID" \
  '. + {
    hookType: $hook,
    timestamp: ($ts | tonumber),
    tmuxTarget: (if $tmux == "" then null else $tmux end),
    paneId: (if $pane == "" then null else $pane end)
  }' <<< "$EVENT")

# Persist to file (always)
echo "$ENHANCED" >> "$EVENTS_FILE"

# Send to server (best effort, non-blocking)
if [[ -n "$CURL" ]]; then
  "$CURL" -s -X POST "$SERVER_URL/event" \
    -H "Content-Type: application/json" \
    -d "$ENHANCED" \
    --connect-timeout 1 \
    --max-time 2 \
    &>/dev/null &
fi

exit 0
