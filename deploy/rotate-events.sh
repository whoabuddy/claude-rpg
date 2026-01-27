#!/usr/bin/env bash
# rotate-events.sh - Rotate events.jsonl for Claude RPG
#
# Archives the current events.jsonl, compresses it, and truncates the active
# file. Safe to run while the server is running (copies then truncates).
#
# Usage:
#   ./deploy/rotate-events.sh              # uses default data dir
#   ./deploy/rotate-events.sh /path/to/data  # custom data dir
#
# Can be run manually or via cron:
#   0 3 * * 0  /home/whoabuddy/dev/whoabuddy/claude-rpg/deploy/rotate-events.sh

set -euo pipefail

DATA_DIR="${1:-$HOME/.claude-rpg/data}"
EVENTS_FILE="$DATA_DIR/events.jsonl"
ARCHIVE_DIR="$DATA_DIR/archive"
MANIFEST_FILE="$ARCHIVE_DIR/manifest.jsonl"

# Ensure archive directory exists
mkdir -p "$ARCHIVE_DIR"

# Check if events file exists and has content
if [[ ! -f "$EVENTS_FILE" ]]; then
  echo "[rotate] No events file found at $EVENTS_FILE"
  exit 0
fi

EVENT_COUNT=$(wc -l < "$EVENTS_FILE" | tr -d ' ')
ORIGINAL_SIZE=$(stat --format=%s "$EVENTS_FILE" 2>/dev/null || stat -f%z "$EVENTS_FILE" 2>/dev/null)

if [[ "$EVENT_COUNT" -eq 0 ]] || [[ "$ORIGINAL_SIZE" -eq 0 ]]; then
  echo "[rotate] Events file is empty, nothing to rotate"
  exit 0
fi

# Generate archive filename with date
DATE_STAMP=$(date +%Y-%m-%d)
ARCHIVE_FILE="$ARCHIVE_DIR/events-${DATE_STAMP}.jsonl"

# Handle multiple rotations on the same day
COUNTER=0
while [[ -f "${ARCHIVE_FILE}.gz" ]]; do
  COUNTER=$((COUNTER + 1))
  ARCHIVE_FILE="$ARCHIVE_DIR/events-${DATE_STAMP}-${COUNTER}.jsonl"
done

echo "[rotate] Archiving $EVENT_COUNT events ($ORIGINAL_SIZE bytes)"
echo "[rotate] Archive: $(basename "$ARCHIVE_FILE").gz"

# Step 1: Copy events to archive
cp "$EVENTS_FILE" "$ARCHIVE_FILE"

# Step 2: Compress the archive
gzip "$ARCHIVE_FILE"

# Step 3: Verify archive integrity
ARCHIVED_COUNT=$(gzip -dc "${ARCHIVE_FILE}.gz" | wc -l | tr -d ' ')
COMPRESSED_SIZE=$(stat --format=%s "${ARCHIVE_FILE}.gz" 2>/dev/null || stat -f%z "${ARCHIVE_FILE}.gz" 2>/dev/null)

if [[ "$ARCHIVED_COUNT" -ne "$EVENT_COUNT" ]]; then
  echo "[rotate] ERROR: Archive line count mismatch (expected $EVENT_COUNT, got $ARCHIVED_COUNT)"
  echo "[rotate] Keeping original events file intact"
  rm -f "${ARCHIVE_FILE}.gz"
  exit 1
fi

# Step 4: Truncate events file (atomic: write empty to tmp, rename)
TMP_FILE="$EVENTS_FILE.tmp"
: > "$TMP_FILE"
mv "$TMP_FILE" "$EVENTS_FILE"

echo "[rotate] Truncated events file"

# Step 5: Log rotation to manifest
MANIFEST_ENTRY=$(cat <<EOF
{"date":"$(date -Iseconds)","archive":"$(basename "${ARCHIVE_FILE}.gz")","eventCount":$EVENT_COUNT,"originalSize":$ORIGINAL_SIZE,"compressedSize":$COMPRESSED_SIZE}
EOF
)
echo "$MANIFEST_ENTRY" >> "$MANIFEST_FILE"

echo "[rotate] Done. $EVENT_COUNT events archived ($ORIGINAL_SIZE -> $COMPRESSED_SIZE bytes)"
