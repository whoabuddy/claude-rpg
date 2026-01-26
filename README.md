# Claude RPG

Mobile-first companion app for [Claude Code](https://claude.ai/code) with RPG progression.

Monitor and interact with multiple Claude Code sessions from your phone while they work in tmux.

## Features

**Tmux Management:**
- **Multi-pane monitoring** - See all your Claude Code sessions at a glance
- **Window/pane controls** - Create windows, split panes, start Claude, close panes
- **Process detection** - Automatically identifies Claude, shell, and running processes

**Claude Code Integration:**
- **Real-time status** - Working, waiting, idle, error states via hooks + terminal parsing
- **Send prompts** - Answer questions, grant permissions, and send input from your phone
- **State reconciliation** - Cross-checks hooks with terminal content to catch missed events
- **Browser notifications** - Get notified when Claude needs input

**RPG Progression:**
- **XP system** - Earn XP for tool usage, git operations, tests, deploys, and more
- **Competitions** - Leaderboards by XP, commits, tests, tools, and prompts
- **Streaks** - Track consecutive days of activity
- **Bitcoin face avatars** - Each Claude session gets a unique generated avatar

**Mobile-First:**
- **Designed for phone** - Use while Claude works on your desktop
- **Disconnection banner** - Clear warning when data is stale, dims content
- **Touch-friendly** - 44px tap targets, expandable pane cards

## Requirements

- [tmux](https://github.com/tmux/tmux) - Terminal multiplexer
- [Claude Code](https://claude.ai/code) - Anthropic's CLI for Claude
- Node.js 18+

For voice input support, see [SETUP.md](./SETUP.md#voice-input-setup-optional).

## Quick Start

```bash
# Clone and install
git clone https://github.com/whoabuddy/claude-rpg.git
cd claude-rpg
npm install

# Build and set up hooks
npm run build
npm run setup

# Start the server
npm run dev
```

Then open http://localhost:4010 on your phone (same network).

> **Note:** HTTPS is required for voice input. See [SETUP.md](./SETUP.md#https-configuration) for certificate options.

## How It Works

1. Run Claude Code sessions in tmux panes
2. The server polls tmux to detect Claude instances
3. Claude Code hooks send events (tool usage, questions, etc.)
4. The React UI displays all panes with real-time updates
5. Tap a pane card to expand and interact

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CLAUDE_RPG_PORT` | 4011 | Server port |
| `CLAUDE_RPG_CLIENT_PORT` | 4010 | Vite dev server port |

For detailed setup including HTTPS certificates, voice input, and mobile access, see **[SETUP.md](./SETUP.md)**.

## Development

```bash
npm run dev          # Start server + client
npm run dev:server   # Server only
npm run dev:client   # Client only
npm run typecheck    # Type check
npm run build        # Production build
```

## Tech Stack

- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Node.js, WebSocket
- **Integration**: tmux, Claude Code hooks

## License

MIT
