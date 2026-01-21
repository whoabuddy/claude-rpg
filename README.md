# Claude RPG

Mobile-first companion app for [Claude Code](https://claude.ai/code) with RPG progression.

Monitor and interact with multiple Claude Code sessions from your phone while they work in tmux.

## Features

- **Multi-pane monitoring** - See all your Claude Code sessions at a glance
- **Mobile-first UI** - Designed for phone use while Claude works on your desktop
- **Send prompts** - Answer questions and send input from your phone
- **Bitcoin face avatars** - Each Claude session gets a unique generated avatar
- **RPG progression** - Earn XP for tool usage, git operations, and more
- **Browser notifications** - Get notified when Claude needs input

## Requirements

- [tmux](https://github.com/tmux/tmux) - Terminal multiplexer
- [Claude Code](https://claude.ai/code) - Anthropic's CLI for Claude
- Node.js 18+

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

## How It Works

1. Run Claude Code sessions in tmux panes
2. The server polls tmux to detect Claude instances
3. Claude Code hooks send events (tool usage, questions, etc.)
4. The React UI displays all panes with real-time updates
5. Tap a pane card to expand and interact

## Screenshots

*Coming soon*

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CLAUDE_RPG_PORT` | 4011 | Server port |
| `CLAUDE_RPG_CLIENT_PORT` | 4010 | Vite dev server port |

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
