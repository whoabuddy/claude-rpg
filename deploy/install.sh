#!/bin/bash
# Claude RPG - First-time setup on Ubuntu Server 24
# Run from the repository root: ./deploy/install.sh

set -e

echo "=== Claude RPG Installation ==="
echo ""

# Check if running from repo root
if [[ ! -f "package.json" ]] || [[ ! -d "deploy" ]]; then
    echo "Error: Please run this script from the claude-rpg repository root"
    echo "  cd ~/claude-rpg && ./deploy/install.sh"
    exit 1
fi

# 1. Check/install Node.js 20 LTS
echo "[1/7] Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -ge 20 ]]; then
        echo "  Node.js $(node --version) found"
    else
        echo "  Node.js $NODE_VERSION is too old, installing v20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    echo "  Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. Install system dependencies
echo "[2/7] Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y jq tmux git

# 3. Install npm dependencies
echo "[3/7] Installing npm dependencies..."
npm install

# 4. Build the project
echo "[4/7] Building project..."
npm run build

# 5. Run setup (installs Claude Code hooks)
echo "[5/7] Setting up Claude Code hooks..."
npm run setup

# 6. Install systemd user service
echo "[6/7] Installing systemd service..."
mkdir -p ~/.config/systemd/user
cp deploy/claude-rpg.service ~/.config/systemd/user/

# Reload systemd, enable and start service
systemctl --user daemon-reload
systemctl --user enable claude-rpg
systemctl --user start claude-rpg

# Enable lingering so service runs without active login session
loginctl enable-linger "$USER"

# 7. Configure firewall (if ufw is active)
echo "[7/7] Configuring firewall..."
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        sudo ufw allow 4011/tcp comment 'Claude RPG'
        echo "  UFW rule added for port 4011"
    else
        echo "  UFW is not active, skipping firewall configuration"
    fi
else
    echo "  UFW not installed, skipping firewall configuration"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Service status:"
systemctl --user status claude-rpg --no-pager || true
echo ""
echo "Access the UI at:"
echo "  - Local:  http://localhost:4011"
echo "  - LAN:    http://$(hostname -I | awk '{print $1}'):4011"
echo ""
echo "Useful commands:"
echo "  systemctl --user status claude-rpg   # Check status"
echo "  systemctl --user restart claude-rpg  # Restart service"
echo "  journalctl --user -u claude-rpg -f   # View logs"
echo "  ~/claude-rpg/deploy/update.sh        # Update to latest"
