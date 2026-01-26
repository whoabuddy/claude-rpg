# Claude RPG

Mobile-first companion for Claude Code with RPG progression.

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

**Status values** (see `SessionStatus` in `shared/types.ts`):
- `idle` -> "Ready": Task complete, awaiting new prompt
- `typing` -> "Active": User activity detected in terminal
- `working` -> "Working": Claude actively processing (tool use)
- `waiting` -> "Waiting": Claude blocked on user input (question/permission) - has glow
- `error` -> "Error": Tool failed, needs attention

## Project Structure

```
claude-rpg/
├── server/               # Node.js backend
│   ├── index.ts          # Main server, HTTP/WS, event processing, static serving, dev proxy
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
│   ├── components/       # UI components (PaneCard, Dashboard, BackendSelector, etc.)
│   ├── hooks/            # React hooks (useWebSocket, useWindows, useNotifications)
│   └── styles/           # Tailwind CSS
├── shared/
│   └── types.ts          # All TypeScript interfaces (shared between server + client)
├── deploy/               # Production deployment
│   ├── claude-rpg.service # systemd user service
│   ├── deploy.sh         # Build + restart service
│   ├── install.sh        # First-time setup on Ubuntu Server
│   ├── update.sh         # Pull latest + rebuild + restart
│   └── README.md         # Deployment docs (tunnel, dev proxy, ports)
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
| `/api/windows/:id/rename` | POST | Rename window (body: `{ windowName }`, enforces unique names per session) |
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
| `/api/admin/backends` | GET | Probe production (:4011) and dev (:4012) backends |
| `/api/admin/backend` | POST | Switch active backend (`{ mode: "production" \| "dev" }`) |

### Static File Serving

In production, the server serves built client assets from `dist/client/`:
- Hashed assets (`/assets/*`): immutable cache (1 year)
- `index.html`: no-cache (SPA fallback for all non-API routes)
- Supported MIME types: `.js`, `.css`, `.html`, `.svg`, `.json`, `.png`, `.ico`, `.woff2`

### Dev Proxy Mode

The production server (port 4011) can proxy API/WS requests to a dev server on
port 4012. This allows testing backend changes remotely through a single
Cloudflare tunnel without needing a second route.

- Toggle via `POST /api/admin/backend` or the BackendSelector UI component
- Admin endpoints (`/api/admin/*`) are never proxied
- Static files are always served from production's `dist/client/`
- WebSocket connections are proxied bidirectionally
- Auto-reverts to production if dev WebSocket fails

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
