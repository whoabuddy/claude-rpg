#!/bin/bash
# Claude RPG - Pull latest and restart
# Run from anywhere: ~/claude-rpg/deploy/update.sh

set -e

# Navigate to repo from script location
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== Claude RPG Update ==="
echo "  Repo: $REPO_DIR"
echo ""

# 1. Pull latest changes
echo "[1/4] Pulling latest changes..."
git pull --ff-only

# 2. Install dependencies (in case they changed)
echo "[2/4] Installing dependencies..."
npm install

# 3. Build
echo "[3/4] Building..."
npm run build

# 4. Restart service
echo "[4/4] Restarting service..."
systemctl --user restart claude-rpg

echo ""
echo "=== Update Complete ==="
echo ""
echo "Service status:"
systemctl --user status claude-rpg --no-pager || true
