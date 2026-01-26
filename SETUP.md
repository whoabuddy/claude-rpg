# Setup Guide

Complete setup instructions for Claude RPG.

## Prerequisites

| Dependency | Version | Check Command |
|------------|---------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| tmux | 3.0+ | `tmux -V` |
| Claude Code | Latest | `claude --version` |

## Installation

### 1. Clone and Install

```bash
git clone https://github.com/whoabuddy/claude-rpg.git
cd claude-rpg
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Setup Hooks

```bash
npm run setup
```

This command:
- Creates `~/.claude-rpg/data/` for companion data and event history
- Creates `~/.claude-rpg/hooks/` and copies the hook script
- Configures `~/.claude/settings.json` with hooks for:
  - `PreToolUse` - Track tool usage before execution
  - `PostToolUse` - Track tool results
  - `Stop` - Detect session completion
  - `UserPromptSubmit` - Capture user prompts
  - `Notification` - Handle notifications

The server also handles `SubagentStop`, `SessionStart`, and `SessionEnd` events if you have those hooks configured separately.

### 4. Start the Server

```bash
npm run dev
```

Opens:
- Client: http://localhost:4010 (HTTPS when certs configured)
- Server: http://localhost:4011

## HTTPS Configuration

HTTPS is required for voice input from mobile devices (browser security policy).

### Auto-Generated Certificate (Default)

Vite automatically generates a self-signed certificate. On first visit, accept the browser security warning.

### mkcert (Recommended)

For certificates trusted by your browser without warnings:

```bash
# Install mkcert (brew install mkcert / sudo apt install mkcert)
mkcert -install

# Generate certificates
mkdir -p ~/.claude-rpg/certs
cd ~/.claude-rpg/certs
mkcert -key-file key.pem -cert-file cert.pem localhost $(hostname -I | awk '{print $1}')
```

The server automatically loads certificates from `~/.claude-rpg/certs/` if present.

## Mobile Access

1. Connect phone to same WiFi network as your computer
2. Open `http://<your-ip>:4010` in mobile browser (use `hostname -I` to find your IP)
3. Accept the security warning if using HTTPS with self-signed certificates
4. Add to home screen for app-like experience

## Running as a Service (Optional)

For persistent operation, use a process manager:

```bash
# pm2 (recommended)
npm install -g pm2
pm2 start npm --name "claude-rpg" -- run dev
pm2 startup && pm2 save  # auto-start on boot
```

Alternatives: systemd service, or a detached tmux session (`tmux new-session -d -s claude-rpg "npm run dev"`).

## Voice Input (Optional)

Voice input requires [whisper.cpp](https://github.com/ggerganov/whisper.cpp) for local speech-to-text. Follow their build instructions, then:

```bash
# Download the base English model
mkdir -p ~/.claude-rpg/models
curl -L -o ~/.claude-rpg/models/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

Voice input is automatically enabled when `whisper` is on PATH and the model file exists.

## Troubleshooting

### "Cannot connect to server"

1. Ensure the server is running: `npm run dev`
2. Check if ports are in use: `lsof -i :4010 -i :4011`

### "Hooks not firing"

1. Verify hooks are configured: `cat ~/.claude/settings.json`
2. Check hook script is executable: `ls -la ~/.claude-rpg/hooks/`
3. Test hook manually: `~/.claude-rpg/hooks/claude-rpg-hook.sh PreToolUse`

### "Voice input not working"

1. Ensure HTTPS is enabled (check URL starts with `https://`)
2. Grant microphone permission when prompted
3. Check whisper installation: `whisper --help`
4. Verify model exists: `ls ~/.claude-rpg/models/`

## Uninstalling

```bash
# Remove Claude RPG data
rm -rf ~/.claude-rpg

# Remove hooks from Claude Code settings
# Edit ~/.claude/settings.json and remove claude-rpg entries from hooks array

# Remove the cloned repository
rm -rf /path/to/claude-rpg
```
