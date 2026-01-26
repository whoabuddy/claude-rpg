# Claude RPG Deployment

Deploy claude-rpg to Ubuntu Server VMs with systemd for process management.

## Architecture

Single Cloudflare tunnel route to production server. Dev proxy mode lets you
test backend changes through the same tunnel without a second route.

```
Browser → tunnel → production server (4011)
                        │
                   [toggle in UI]
                   /              \
            handle locally    proxy → dev server (4012)
            (production)        on localhost
```

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
git clone https://github.com/whoabuddy/claude-rpg.git ~/dev/whoabuddy/claude-rpg
cd ~/dev/whoabuddy/claude-rpg

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
./deploy/update.sh
```

### Deploy (Build + Restart)

```bash
npm run deploy
```

This builds the project and restarts the systemd service.

## Dev Proxy Mode

The production server can proxy API and WebSocket requests to a dev server
running on localhost:4012. This lets you test backend changes remotely through
the tunnel without needing a second route.

### How It Works

1. Production server always runs on port 4011 (systemd)
2. Dev server runs on port 4012 (`npm run dev` sets `CLAUDE_RPG_PORT=4012`)
3. A "Backend Selector" in the UI header lets you toggle between prod and dev
4. When dev mode is active, API/WS requests are proxied to :4012
5. Static files are always served from production's `dist/client/`
6. Admin endpoints (`/api/admin/*`) are never proxied

### Dev Workflow

```bash
# Start dev server (hot reload, port 4012 backend, port 4010 Vite)
npm run dev

# Toggle to "dev" in the UI at your tunnel URL
# All API/WS traffic now goes through production → dev server

# When done, toggle back to "prod" or just stop the dev server
# (auto-reverts on WebSocket failure)
```

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/backends` | GET | Probe production and dev backends, return status |
| `/api/admin/backend` | POST | Switch active backend (`{ mode: "production" \| "dev" }`) |

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

## Port Assignments

| Service | Port | Context |
|---------|------|---------|
| Production server | 4011 | systemd / `npm start` |
| Dev backend | 4012 | `npm run dev:server` |
| Dev frontend (Vite) | 4010 | `npm run dev:client` |

## Cloudflare Tunnel

Configure your tunnel route to point to `http://localhost:4011` (not `https`).
Cloudflare terminates TLS at the edge, so the local connection is plain HTTP.

No second route is needed - dev proxy mode handles backend switching through
the single tunnel.

## Access

After installation:

- **Local**: http://localhost:4011
- **LAN**: http://<vm-ip>:4011
- **Tunnel**: https://your-tunnel-domain (configure in Cloudflare dashboard)

## Files

| File | Purpose |
|------|---------|
| `~/.config/systemd/user/claude-rpg.service` | Installed systemd service |
| `~/.claude-rpg/data/` | Persistent data (companions, events) |
| `~/.claude/settings.json` | Claude Code hooks configuration |

## Network Configuration

### Firewall (UFW)

The install script automatically adds a UFW rule. To do it manually:

```bash
sudo ufw allow 4011/tcp comment 'Claude RPG'
```

## Troubleshooting

### Service won't start

```bash
# Check logs for errors
journalctl --user -u claude-rpg --no-pager -n 50

# Verify build exists
ls -la ~/dev/whoabuddy/claude-rpg/dist/server/

# Rebuild if needed
cd ~/dev/whoabuddy/claude-rpg && npm run build
```

### Port already in use

```bash
# Check what's using the port
lsof -i :4011

# Kill the process or change the port
CLAUDE_RPG_PORT=4013 node dist/server/index.js
```

### Hooks not working

```bash
# Verify hooks are installed
cat ~/.claude/settings.json | jq '.hooks'

# Re-run setup
cd ~/dev/whoabuddy/claude-rpg && npm run setup
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
