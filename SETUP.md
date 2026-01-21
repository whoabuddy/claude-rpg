# Setup Guide

Complete setup instructions for Claude RPG.

## Prerequisites

### Required

| Dependency | Version | Check Command |
|------------|---------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| tmux | 3.0+ | `tmux -V` |
| Claude Code | Latest | `claude --version` |

### Optional (for voice input)

| Dependency | Version | Check Command |
|------------|---------|---------------|
| cmake | 3.10+ | `cmake --version` |
| whisper.cpp | Latest | `whisper --help` |

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

This compiles:
- TypeScript server to `dist/server/`
- React client to `dist/client/`

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

### 4. Start the Server

```bash
npm run dev
```

Opens:
- Client: https://localhost:4010
- Server: http://localhost:4011

## HTTPS Configuration

HTTPS is required for voice input from mobile devices (browser security policy).

### Option A: Vite Auto-Generated Certificate (Default)

Vite automatically generates a self-signed certificate. On first visit:
1. Browser shows security warning
2. Click "Advanced" → "Proceed to localhost"
3. Accept the certificate

### Option B: Custom Certificates

For a cleaner experience, generate your own certificates:

```bash
# Create certs directory
mkdir -p ~/.claude-rpg/certs
cd ~/.claude-rpg/certs

# Generate self-signed certificate (valid 365 days)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=claude-rpg" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$(hostname -I | awk '{print $1}')"
```

The server automatically loads certificates from `~/.claude-rpg/certs/` if present.

### Option C: mkcert (Recommended for Development)

For certificates trusted by your browser:

```bash
# Install mkcert
brew install mkcert  # macOS
# or: sudo apt install mkcert  # Ubuntu/Debian

# Install local CA
mkcert -install

# Generate certificates
mkdir -p ~/.claude-rpg/certs
cd ~/.claude-rpg/certs
mkcert -key-file key.pem -cert-file cert.pem localhost $(hostname -I | awk '{print $1}')
```

## Mobile Access

### Find Your Local IP

```bash
# Linux
hostname -I | awk '{print $1}'

# macOS
ipconfig getifaddr en0
```

### Access from Phone

1. Connect phone to same WiFi network as your computer
2. Open `https://<your-ip>:4010` in mobile browser
3. Accept the security warning (self-signed certificate)
4. Add to home screen for app-like experience

### Firewall

If you can't connect, ensure port 4010 is open:

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 4010

# Fedora/RHEL (firewalld)
sudo firewall-cmd --add-port=4010/tcp --permanent
sudo firewall-cmd --reload
```

## Voice Input Setup (Optional)

Voice input requires whisper.cpp for local speech-to-text transcription.

### 1. Install Build Dependencies

```bash
# Ubuntu/Debian
sudo apt install cmake build-essential

# Fedora/RHEL
sudo dnf install cmake gcc-c++ make

# macOS
brew install cmake
```

### 2. Build whisper.cpp

```bash
# Clone whisper.cpp
cd ~/
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Build
cmake -B build
cmake --build build --config Release

# Install (adds 'whisper' to PATH)
sudo cp build/bin/whisper /usr/local/bin/
```

### 3. Download Model

```bash
# Create models directory
mkdir -p ~/.claude-rpg/models

# Download base English model (~142MB)
curl -L -o ~/.claude-rpg/models/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

### 4. Verify Installation

```bash
# Check whisper is available
whisper --help

# Check model exists
ls -la ~/.claude-rpg/models/ggml-base.en.bin
```

Voice input will be automatically enabled when whisper is detected.

## Directory Structure

After setup, your directories will look like:

```
~/.claude-rpg/
├── data/
│   ├── companions.json    # Companion XP and stats
│   ├── panes-cache.json   # Session cache (avatars)
│   └── events.jsonl       # Event history
├── hooks/
│   └── claude-rpg-hook.sh # Hook script
├── certs/                 # Optional: HTTPS certificates
│   ├── key.pem
│   └── cert.pem
└── models/                # Optional: Whisper model
    └── ggml-base.en.bin

~/.claude/
└── settings.json          # Claude Code settings (hooks configured here)
```

## Troubleshooting

### "Cannot connect to server"

1. Ensure the server is running: `npm run dev`
2. Check if ports are in use: `lsof -i :4010 -i :4011`
3. Try restarting: `Ctrl+C` then `npm run dev`

### "Hooks not firing"

1. Verify hooks are configured: `cat ~/.claude/settings.json`
2. Check hook script is executable: `ls -la ~/.claude-rpg/hooks/`
3. Test hook manually: `~/.claude-rpg/hooks/claude-rpg-hook.sh PreToolUse`

### "Voice input not working"

1. Ensure HTTPS is enabled (check URL starts with `https://`)
2. Grant microphone permission when prompted
3. Check whisper installation: `whisper --help`
4. Verify model exists: `ls ~/.claude-rpg/models/`

### "Can't access from phone"

1. Verify same WiFi network
2. Check local IP: `hostname -I`
3. Test connection: `curl -k https://<ip>:4010` from another machine
4. Check firewall rules

### "Certificate errors"

1. For self-signed certs, accept the browser warning
2. On iOS: Settings → General → About → Certificate Trust Settings
3. Consider using mkcert for trusted local certificates

## Uninstalling

```bash
# Remove Claude RPG data
rm -rf ~/.claude-rpg

# Remove hooks from Claude Code settings
# Edit ~/.claude/settings.json and remove claude-rpg entries from hooks array

# Remove the cloned repository
rm -rf /path/to/claude-rpg
```
