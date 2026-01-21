# Claude RPG

Mobile-first companion for Claude Code with RPG progression.

## Quick Start

```bash
# Install dependencies
npm install

# Start development (server + client)
npm run dev

# Set up Claude Code hooks
npm run setup
```

## Architecture

```
Tmux Polling (1s)     Claude Hooks
       ↓                    ↓
   TmuxState          correlate by
       ↓              paneId/target
   [Windows]              ↓
       ↓            [Pane.claudeSession]
   [Panes] ←──────────────┘
       ↓
   WebSocket → React UI
```

### Key Concepts

- **Pane** = Tmux pane = Primary unit of observation (ephemeral, polled from tmux)
- **Window** = Tmux window = Groups panes (matches tmux status bar)
- **ClaudeSession** = Claude instance in a pane with avatar, status, questions
- **Companion** = Git repo = Project with RPG progression (level, XP, stats) - persisted
- **Process Detection** = Classifies panes: claude | shell | process | idle

### Data Model

```typescript
// Primary (ephemeral - polled from tmux)
TmuxWindow {
  id: string              // "work:1"
  sessionName: string     // "work"
  windowIndex: number     // 1
  windowName: string      // "claude-rpg"
  panes: TmuxPane[]
}

TmuxPane {
  id: string              // "%51" (unique pane ID)
  target: string          // "work:2.0"
  process: PaneProcess
  cwd: string
  repo?: RepoInfo
  terminalContent?: string
}

PaneProcess {
  type: 'claude' | 'shell' | 'process' | 'idle'
  command: string
  pid: number
  claudeSession?: ClaudeSessionInfo  // only when type='claude'
}

ClaudeSessionInfo {
  id: string              // session UUID
  name: string            // "Alice" (English name)
  avatarSvg?: string      // Bitcoin face
  status: 'idle' | 'typing' | 'working' | 'waiting' | 'error'
  pendingQuestion?: PendingQuestion
  currentTool?: string    // Currently executing tool
  lastPrompt?: string     // Last user prompt
}

// Status values → Display labels:
// - idle → "Ready": Task complete, awaiting new prompt
// - typing → "Active": User activity detected in terminal
// - working → "Working": Claude actively processing (tool use)
// - waiting → "Waiting": Claude blocked on user input (question/permission) - has glow
// - error → "Error": Tool failed, needs attention

// Secondary (persisted for XP/stats)
Companion {
  id, name, repo, level, experience, stats
}
```

## Project Structure

```
claude-rpg/
├── server/           # Node.js WebSocket server
│   ├── index.ts      # Main server, event processing, WebSocket
│   ├── tmux.ts       # Tmux polling, process detection, session cache
│   ├── companions.ts # Companion XP/stats, Bitcoin faces
│   ├── xp.ts         # XP calculation, command detection
│   ├── utils.ts      # Shared utilities
│   └── cli.ts        # CLI for setup and running
├── src/              # React + Tailwind frontend
│   ├── components/   # UI components
│   │   ├── OverviewDashboard.tsx # All panes in stable order
│   │   ├── PaneCard.tsx          # Expandable pane card (Claude + Process)
│   │   └── ConnectionStatus.tsx  # WebSocket status indicator
│   ├── hooks/        # React hooks
│   │   ├── useWindows.ts         # Window/pane state with deep equality
│   │   ├── usePaneTerminal.ts    # Terminal content by paneId
│   │   ├── useWebSocket.ts       # WebSocket connection
│   │   ├── useCompanions.ts      # Companion stats (for XP display)
│   │   └── useNotifications.ts   # Browser notifications
│   └── styles/       # Tailwind CSS
├── shared/           # Shared types between server/client
│   ├── types.ts      # TypeScript interfaces
│   └── defaults.ts   # Configuration defaults
└── hooks/            # Claude Code hook script
    └── claude-rpg-hook.sh
```

## Data Flow

1. Server polls tmux every 1 second for all windows/panes
2. Server detects Claude instances via process detection
3. Claude Code hook captures events with `paneId` and `tmuxTarget`
4. Server correlates hook events with panes by ID
5. On new Claude session: assigns English name, fetches Bitcoin face
6. Server detects AskUserQuestion → sets status to 'waiting'
7. Server calculates XP and updates companion stats
8. Server broadcasts updates via WebSocket
9. React UI renders panes grouped by window or status
10. User can answer questions, send prompts to any pane

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/event` | POST | Receive events from hook |
| `/api/windows` | GET | List all windows with panes |
| `/api/panes/:id` | GET | Get single pane detail |
| `/api/panes/:id/prompt` | POST | Send prompt/input to pane |
| `/api/panes/:id/signal` | POST | Send signal (e.g., SIGINT for Ctrl+C) |
| `/api/companions` | GET | List all companions (XP/stats) |

## WebSocket Messages

**Server → Client:**
- `connected` - Initial connection
- `windows` - All windows/panes (polled every 1s)
- `pane_update` - Single pane changed
- `pane_removed` - Pane closed
- `companions` - All companions on connect
- `companion_update` - Single companion XP/stats changed
- `event` - New Claude event
- `xp_gain` - XP was awarded
- `history` - Recent events on connect
- `terminal_output` - Terminal content for a pane

## XP System

**Tool Usage:**
- Read: 1 XP, Edit: 3 XP, Write: 5 XP, Bash: 2 XP, Task: 5 XP

**Git Operations (detected from Bash commands):**
- git commit: 15 XP
- git push: 10 XP
- gh pr create: 20 XP
- gh pr merge: 50 XP

**Dev Commands:**
- npm test / vitest / pytest: 5 XP
- npm run build: 3 XP
- npm run lint / eslint / prettier: 2 XP
- wrangler / vercel deploy: 10 XP

**Blockchain (Stacks):**
- clarinet check: 5 XP
- clarinet test: 8 XP
- testnet deploy: 25 XP
- mainnet deploy: 100 XP

**Level Curve:**
```typescript
xpForLevel(n) = 100 * 1.5^(n-1)
// Level 1: 100 XP, Level 10: 3,844 XP, Level 20: 221,644 XP
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CLAUDE_RPG_PORT` | 4011 | Server port |
| `CLAUDE_RPG_CLIENT_PORT` | 4010 | Vite dev server port |
| `CLAUDE_RPG_DATA_DIR` | ~/.claude-rpg/data | Data directory |

## Files

| File | Purpose |
|------|---------|
| `~/.claude-rpg/data/companions.json` | Companion XP + stats |
| `~/.claude-rpg/data/panes-cache.json` | Claude session cache (avatars) |
| `~/.claude-rpg/data/events.jsonl` | Event history (append-only) |
| `~/.claude-rpg/hooks/claude-rpg-hook.sh` | Installed hook script |
| `~/.claude/settings.json` | Claude Code hook configuration |

## Development

```bash
# Run server only
npm run dev:server

# Run client only
npm run dev:client

# Type check
npm run typecheck

# Build for production
npm run build
```

## Process Detection

The server detects what's running in each pane:

| Process Type | Detection |
|-------------|-----------|
| `claude` | `pane_current_command === 'claude'` OR child process includes 'claude' |
| `shell` | bash/zsh/sh/fish with no children |
| `process` | Shell with children, or non-shell process (node, python, etc.) |
| `idle` | Fallback for undetected state |

## UI Navigation

- **Dashboard**: All panes displayed in stable order (by window/pane position)
- **Pane Cards**: Expandable cards showing avatar, status, terminal output
- **Interactions**: Tap to expand, send prompts, answer questions, Ctrl+C
- **Auto-focus**: Text input focuses automatically when expanding a card

## Mobile-First Design

- Tailwind with custom RPG color palette
- Touch-friendly tap targets (min 44px)
- Pane cards with Bitcoin face avatars
- Clickable answer buttons for AskUserQuestion
- Terminal output per pane
- Floating attention badge when panes need input

## Adding New Command XP

Edit `server/xp.ts`:

```typescript
// In detectCommandXP()
if (cmd.includes('your-command')) {
  return { type: 'commands.custom', xp: 5, statKey: 'commands.customRun' }
}
```

Then add the stat key to the `CompanionStats` interface in `shared/types.ts`.
