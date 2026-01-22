# Claude RPG Deployment

Deploy claude-rpg to Ubuntu Server VMs with systemd for process management.

## Architecture

Each VM runs independently, monitoring its own local tmux sessions:

```
┌─────────────────────────────────────────────────────────────┐
│                     VM (Ubuntu 24)                          │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐  │
│  │   tmux      │────▶│ claude-rpg   │────▶│  Browser UI  │  │
│  │  sessions   │     │   :4011      │     │   :4011      │  │
│  └─────────────┘     └──────────────┘     └──────────────┘  │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌─────────────┐     ┌──────────────┐                       │
│  │ Claude Code │────▶│ ~/.claude-rpg│                       │
│  │   hooks     │     │    /data     │                       │
│  └─────────────┘     └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Fresh Install

```bash
# Clone the repository
git clone https://github.com/whoabuddy/claude-rpg.git ~/claude-rpg
cd ~/claude-rpg

# Run the install script
chmod +x deploy/install.sh
./deploy/install.sh
```

The install script will:
1. Install Node.js 20 LTS (if needed)
2. Install system dependencies (jq, tmux, git)
3. Install npm dependencies and build
4. Set up Claude Code hooks
5. Install and start systemd user service
6. Configure UFW firewall (if active)

### Update to Latest

```bash
~/claude-rpg/deploy/update.sh
```

## Service Management

Claude RPG runs as a systemd user service:

```bash
# Check status
systemctl --user status claude-rpg

# View logs
journalctl --user -u claude-rpg -f

# Restart service
systemctl --user restart claude-rpg

# Stop service
systemctl --user stop claude-rpg

# Start service
systemctl --user start claude-rpg
```

## Access

After installation:

- **Local**: http://localhost:4011
- **LAN**: http://<vm-ip>:4011

## Files

| File | Purpose |
|------|---------|
| `~/.config/systemd/user/claude-rpg.service` | Installed systemd service |
| `~/.claude-rpg/data/` | Persistent data (companions, events) |
| `~/.claude/settings.json` | Claude Code hooks configuration |

## Docker (Limited)

Docker support is provided for convenience but has **limited functionality**:

- Tmux monitoring does not work in Docker (tmux sessions are host-local)
- Use Docker only for testing or if you don't need tmux integration

```bash
cd deploy
docker compose build
docker compose up -d
```

For full functionality, use the systemd service.

## Network Configuration

### Firewall (UFW)

The install script automatically adds a UFW rule. To do it manually:

```bash
sudo ufw allow 4011/tcp comment 'Claude RPG'
```

### Remote Access Options

1. **LAN only** (default): Access via VM IP on local network
2. **SSH tunnel**: `ssh -L 4011:localhost:4011 user@vm`
3. **Reverse proxy**: nginx/caddy with SSL termination
4. **Cloudflare Tunnel** (future): Zero-trust access with GitHub auth

## Troubleshooting

### Service won't start

```bash
# Check logs for errors
journalctl --user -u claude-rpg --no-pager -n 50

# Verify build exists
ls -la ~/claude-rpg/dist/server/

# Rebuild if needed
cd ~/claude-rpg && npm run build
```

### Port already in use

```bash
# Check what's using the port
lsof -i :4011

# Kill the process or change the port
CLAUDE_RPG_PORT=4012 node dist/server/index.js
```

### Hooks not working

```bash
# Verify hooks are installed
cat ~/.claude/settings.json | jq '.hooks'

# Re-run setup
cd ~/claude-rpg && npm run setup
```

### Service stops after logout

```bash
# Enable lingering (keeps user services running)
loginctl enable-linger $USER
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_RPG_PORT` | 4011 | Server port |
| `CLAUDE_RPG_DATA_DIR` | ~/.claude-rpg/data | Data directory |
| `NODE_ENV` | production | Node environment |
