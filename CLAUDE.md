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
Tmux Polling (250ms)    Claude Hooks (HTTP POST)
       |                        |
   tmux.ts               server/index.ts
       |                  normalizeEvent()
   [Windows]                    |
       |              correlate by paneId
   [Panes] <--------------------+
       |                        |
   captureTerminal()     handleEvent()
       |                   |        |
   terminal-parser.ts   XP calc   state update
       |                   |        |
   state-reconciler.ts  xp.ts    companions.ts
       |
   WebSocket (backpressure) --> React UI
```

### Key Concepts

- **Pane** = Tmux pane = Primary unit of observation (ephemeral, polled from tmux)
- **Window** = Tmux window = Groups panes (matches tmux status bar)
- **ClaudeSession** = Claude instance in a pane with avatar, status, questions
- **Companion** = Git repo = Project with RPG progression (level, XP, stats) - persisted
- **Process Detection** = Classifies panes: claude | shell | process | idle
- **State Reconciliation** = Cross-checks hook state with terminal content to fix drift
- **Terminal Prompt Detection** = Parses terminal output to detect permission/question prompts

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
  paneIndex: number       // 0
  isActive: boolean       // active pane in window
  process: PaneProcess
  cwd: string
  repo?: RepoInfo
  terminalContent?: string
}

PaneProcess {
  type: 'claude' | 'shell' | 'process' | 'idle'
  command: string
  pid: number
  typing?: boolean        // true if terminal content changed recently
  claudeSession?: ClaudeSessionInfo  // only when type='claude'
}

ClaudeSessionInfo {
  id: string              // session UUID
  name: string            // "Alice" (English name)
  avatarSvg?: string      // Bitcoin face
  status: SessionStatus
  terminalPrompt?: TerminalPrompt  // Source of truth from terminal parsing
  pendingQuestion?: PendingQuestion  // Deprecated: kept for fallback
  lastError?: SessionError
  currentTool?: string    // Currently executing tool
  currentFile?: string    // File being worked on
  lastPrompt?: string     // Last user prompt (truncated for display)
  recentFiles?: string[]  // Recently touched files (last 5 unique)
  stats?: SessionStats    // Per-session stats (in-memory only)
  createdAt: number
  lastActivity: number
}

// Status values -> Display labels:
// - idle -> "Ready": Task complete, awaiting new prompt
// - typing -> "Active": User activity detected in terminal
// - working -> "Working": Claude actively processing (tool use)
// - waiting -> "Waiting": Claude blocked on user input (question/permission) - has glow
// - error -> "Error": Tool failed, needs attention

// Secondary (persisted for XP/stats)
Companion {
  id, name, repo, level, experience, totalExperience, stats, streak
}

StreakInfo {
  current: number      // Current consecutive days
  longest: number      // All-time longest streak
  lastActiveDate: string  // YYYY-MM-DD format
}
```

## Project Structure

```
claude-rpg/
├── server/               # Node.js backend
│   ├── index.ts          # Main server, HTTP/WS, event processing, all API endpoints
│   ├── tmux.ts           # Tmux polling, pane/window discovery, process detection
│   ├── tmux-batch.ts     # Batched tmux commands (send-keys, buffer ops)
│   ├── tmux-control.ts   # Tmux control mode client (pane events)
│   ├── terminal-parser.ts # Parse terminal output for prompts (permission, question, plan)
│   ├── state-reconciler.ts # Cross-check hook state vs terminal content
│   ├── xp.ts             # XP calculation from tool usage, git ops, commands
│   ├── companions.ts     # Companion CRUD, level progression, persistence
│   ├── competitions.ts   # Leaderboard aggregation by category/period
│   ├── whisper.ts        # Voice input transcription via whisper.cpp
│   ├── cli.ts            # CLI setup command (hooks, directories)
│   └── utils.ts          # Shared utilities (stripAnsi, findWindowById)
├── src/                  # React frontend
│   ├── App.tsx           # Root component, page routing
│   ├── components/       # UI components (PaneCard, Dashboard, Leaderboards)
│   ├── hooks/            # React hooks (useWebSocket, useWindows, useNotifications)
│   └── styles/           # Tailwind CSS
├── shared/
│   └── types.ts          # All TypeScript interfaces (shared between server + client)
└── hooks/
    └── claude-rpg-hook.sh  # Claude Code hook script (installed to ~/.claude-rpg/hooks/)
```

## Data Flow

1. Server polls tmux every 250ms for all windows/panes
2. Server detects Claude instances via process detection (command name + child processes)
3. Claude Code hooks POST events to `/event` with `paneId` and `tmuxTarget`
4. Server correlates hook events with polled panes by ID
5. On new Claude session: assigns English name, fetches Bitcoin face avatar
6. Terminal capture runs at adaptive intervals (250ms-5s based on activity)
7. Terminal parser detects prompts (permission, question, plan) from terminal content
8. State reconciler cross-checks hook-reported status against terminal state
9. Server calculates XP and updates companion stats
10. WebSocket broadcasts updates with backpressure (priority-based message dropping)
11. React UI renders panes grouped by window, with disconnection banner when offline

## Claude Code Integration

### Hook Events

The server processes 8 event types from Claude Code hooks:

| Event Type | Hook | Description |
|-----------|------|-------------|
| `pre_tool_use` | PreToolUse | Tool about to execute (sets status to working) |
| `post_tool_use` | PostToolUse | Tool finished (XP calculation, file tracking) |
| `stop` | Stop | Claude finished responding (sets status to idle) |
| `user_prompt_submit` | UserPromptSubmit | User sent a prompt |
| `notification` | Notification | Claude sent a notification |
| `subagent_stop` | SubagentStop | Subagent finished |
| `session_start` | SessionStart | New session started (or /clear) |
| `session_end` | SessionEnd | Session ended |

**Configured by `npm run setup`:** PreToolUse, PostToolUse, Stop, UserPromptSubmit, Notification

**Handled but not auto-configured:** SubagentStop, SessionStart, SessionEnd (these fire if the user has them configured separately)

### State Detection

Claude session status is determined by two systems working together:

1. **Hook events** (primary): PreToolUse sets working, Stop sets idle, AskUserQuestion sets waiting
2. **Terminal content** (reconciliation): Parses last 50 lines for prompt patterns, spinner characters, idle indicators

The state reconciler (`server/state-reconciler.ts`) resolves conflicts:
- Terminal shows prompt but hook says working -> trust terminal (waiting)
- Hook says waiting but no prompt visible -> prompt was answered (working/idle)
- Hook says working but terminal shows idle for 5s+ -> missed Stop hook (idle)
- Hook says working but terminal unknown for 10s+ -> assume finished (idle)

### Tracking Claude Code Changes

Claude Code releases frequently. Changes that affect claude-rpg fall into three categories:

**Integration surface (hooks):** New hook types, changed payload fields, new tool names. Check hook payloads in `normalizeEvent()` and `handleEvent()` in `server/index.ts`.

**Terminal output patterns:** New spinner styles, changed prompt formats, new UI elements. Check patterns in `server/terminal-parser.ts` and `server/state-reconciler.ts`.

**Process detection:** Changes to how Claude Code appears in process trees. Check `classifyProcess()` in `server/tmux.ts`.

To audit: compare Claude Code release notes (focus on hooks, terminal UI, and process changes) against what the server expects.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/event` | POST | Receive events from Claude Code hook |
| `/api/windows` | GET | List all windows with panes |
| `/api/windows/create` | POST | Create new tmux window (body: `{ sessionName, windowName? }`) |
| `/api/windows/:id/new-pane` | POST | Split new pane in window |
| `/api/windows/:id/new-claude` | POST | Split new pane and start Claude Code |
| `/api/panes/:id` | GET | Get single pane detail |
| `/api/panes/:id/prompt` | POST | Send prompt/input to pane |
| `/api/panes/:id/signal` | POST | Send signal (e.g., SIGINT for Ctrl+C) |
| `/api/panes/:id/dismiss` | POST | Dismiss waiting status (set to ready) |
| `/api/panes/:id/refresh` | POST | Refresh pane (scroll to bottom, reset state) |
| `/api/panes/:id/close` | POST | Close/kill pane |
| `/api/companions` | GET | List all companions (XP/stats) |
| `/api/competitions` | GET | All categories, all time periods |
| `/api/competitions/:category` | GET | Single category, optional `?period=` query |
| `/api/competitions/streaks` | GET | All companion streaks |
| `/api/transcribe` | POST | Transcribe audio via whisper.cpp |

## WebSocket Messages

**Server -> Client:**
- `connected` - Initial connection
- `windows` - All windows/panes (polled every 250ms, with backpressure)
- `pane_update` - Single pane changed (high priority, always sent)
- `pane_removed` - Pane closed (high priority, always sent)
- `companions` - All companions on connect
- `companion_update` - Single companion XP/stats changed
- `competitions` - All competition leaderboards on connect
- `event` - New Claude event (low priority, skipped under backpressure)
- `xp_gain` - XP was awarded
- `history` - Recent events on connect
- `terminal_output` - Terminal content for a pane (low priority, skipped under backpressure)

### WebSocket Backpressure

When a client's send buffer exceeds 64KB, the server pauses non-critical messages:
- **High priority** (always sent): `pane_update`, `pane_removed`
- **Normal priority** (paused when buffered): `windows`, `companions`, `competitions`, `xp_gain`
- **Low priority** (dropped when buffered): `terminal_output`, `event`

Resumes when buffer drops below 16KB.

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
npm run dev          # Start server + client (concurrently)
npm run dev:server   # Server only (tsx watch)
npm run dev:client   # Client only (vite)
npm run build        # Production build (server + client)
npm run build:server # Server only (tsc)
npm run build:client # Client only (vite build)
npm run start        # Run production server
npm run setup        # Install hooks + create directories
npm run typecheck    # Type check (tsc --noEmit)
npm run lint         # ESLint
```

## Process Detection

The server detects what's running in each pane:

| Process Type | Detection |
|-------------|-----------|
| `claude` | `pane_current_command === 'claude'` OR child process includes 'claude' |
| `shell` | bash/zsh/sh/fish with no children |
| `process` | Shell with children, or non-shell process (node, python, etc.) |
| `idle` | Fallback for undetected state |

## Terminal Capture

Terminal content is captured at adaptive intervals based on pane activity:

| State | Interval | Trigger |
|-------|----------|---------|
| Active | 250ms | Content changed within last 2s |
| Working/Waiting | 500ms | Claude pane in working or waiting status |
| Idle | 2000ms | Non-Claude pane or stable Claude pane |
| Backoff | 5000ms | 10+ consecutive captures with no change |

## UI Navigation

- **Dashboard**: All panes displayed in stable order (by window/pane position)
- **Pane Cards**: Expandable cards showing avatar, status, terminal output
- **Interactions**: Tap to expand, send prompts, answer questions, Ctrl+C
- **Auto-focus**: Text input focuses automatically when expanding a card
- **Competitions**: Leaderboards by XP, commits, tests, tools, prompts
- **Connection Banner**: Full-width disconnect warning with elapsed time, dims stale content

## Mobile-First Design

- Tailwind with custom RPG color palette
- Touch-friendly tap targets (min 44px)
- Pane cards with Bitcoin face avatars
- Clickable answer buttons for AskUserQuestion
- Terminal output per pane
- Floating attention badge when panes need input
- Tmux window/pane management (create, split, close)

## Adding New Command XP

Edit `server/xp.ts`:

```typescript
// In detectCommandXP()
if (cmd.includes('your-command')) {
  return { type: 'commands.custom', xp: 5, statKey: 'commands.customRun' }
}
```

Then add the stat key to the `CompanionStats` interface in `shared/types.ts`.
