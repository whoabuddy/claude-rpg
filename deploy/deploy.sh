#!/bin/bash
# Claude RPG - Build and restart production service
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== Claude RPG Deploy ==="
echo "  Repo: $REPO_DIR"
echo ""

echo "[1/3] Building client..."
bun run build:client

echo "[2/3] Restarting service..."
systemctl --user restart claude-rpg

echo "[3/3] Verifying..."
systemctl --user status claude-rpg --no-pager

echo ""
echo "=== Deploy Complete ==="
