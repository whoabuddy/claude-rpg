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
├── server-v2/            # Bun server (v2)
│   ├── index.ts          # Main server, HTTP/WS, event processing, static serving
│   ├── api/              # HTTP API routes
│   ├── modules/          # Core modules (tmux, companions, achievements, etc.)
│   └── db/               # SQLite database and migrations
├── server/               # Legacy Node.js server (v1, deprecated)
├── src/                  # React frontend
│   ├── App.tsx           # Root component with React Router
│   ├── routes/           # Page components (DashboardPage, PersonasPage, etc.)
│   ├── store/            # Zustand state management
│   │   └── index.ts      # Centralized store with slices and selectors
│   ├── lib/              # Core modules
│   │   ├── websocket.ts  # WebSocket client, direct store updates
│   │   └── api.ts        # HTTP API client (pane/window actions)
│   ├── components/       # UI components (PaneCard, Layout, RadarChart, etc.)
│   ├── hooks/            # React hooks (useConnection, useNotifications)
│   ├── contexts/         # React contexts (PaneActionsContext)
│   ├── __tests__/        # Bun tests with happy-dom
│   └── styles/           # Tailwind CSS
├── shared/
│   └── types.ts          # All TypeScript interfaces (shared between server + client)
├── scripts/              # Build scripts
│   └── build-client.ts   # Bun client build (replaces Vite)
├── deploy/               # Production deployment
│   ├── claude-rpg.service # systemd user service (runs Bun)
│   ├── deploy.sh         # Build + restart service
│   ├── install.sh        # First-time setup on Ubuntu Server
│   ├── update.sh         # Pull latest + rebuild + restart
│   └── README.md         # Deployment docs (tunnel, dev proxy, ports)
└── hooks/
    └── claude-rpg-hook.sh  # Claude Code hook script
```

## Build System

- **Server**: Runs directly with Bun (no build step) - `bun run server-v2/index.ts`
- **Client**: Built with Bun (`scripts/build-client.ts`) - outputs to `dist/client/`
  - Code splitting with lazy-loaded routes
  - Tailwind CSS minification
  - Content-hashed assets for caching
- **Tests**: `bun test` with happy-dom for DOM testing

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
11. Client WebSocket module (`src/lib/websocket.ts`) updates Zustand store directly
12. React components use store selectors for reactive updates

## Client State Management

The client uses **Zustand** for centralized state management:

```
WebSocket Message → src/lib/websocket.ts → Zustand Store → React Components
                    handleMessage()        store.setWindows()    useStore()
```

**Store slices** (`src/store/index.ts`):
- `windows` - Tmux windows and panes (from WebSocket)
- `companions` - Projects with XP/stats (from WebSocket)
- `quests` - Active and completed quests
- `competitions` - Leaderboards by category/period
- `workers` - Claude session metadata
- `recentEvents` / `recentXPGains` - Event history
- `status` / `reconnectAttempt` - Connection state
- UI state: `selectedPaneId`, `fullScreenPaneId`, `activePage`

**Selector hooks** (memoized, prevent unnecessary re-renders):
- `useClaudePanes()` - All Claude panes across windows
- `useAttentionPanes()` - Panes needing user input (waiting/error)
- `useCompanion(id)` - Single companion by ID
- `useActiveQuests()` - Quests with status='active'
- `useTerminalContent(paneId)` - Cached terminal output

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

## Notification System

Multiple notification channels alert users when Claude needs attention:

| Channel | Trigger | Configuration |
|---------|---------|---------------|
| **Toast** | All status changes | Always enabled |
| **Browser** | Waiting, error, complete | Settings > Enable |
| **Sound** | Waiting, error, complete, XP, achievement | Settings > Sound Effects |
| **Discord** | Waiting, error, complete | Settings > Webhook URL |

**Sound effects** use Web Audio API synthesis (no external files). Sounds:
- `waiting` - two-tone chime
- `complete` - upward arpeggio
- `error` - low buzz
- `achievement` - sparkle
- `xp` - coin sound

**Discord webhooks** send colored embeds with session name, repo, and question context.

## Voice Input

Push-to-talk voice transcription using whisper.cpp:

- **Client**: MediaRecorder → WAV encoding → POST to `/api/transcribe`
- **Server**: whisper.cpp with base.en model (~140MB)
- **Backup**: Audio stored in localStorage during processing for crash recovery
- **Mobile**: Haptic feedback, iOS Safari AudioContext handling

Model location: `~/.claude-rpg/models/ggml-base.en.bin`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/event` | POST | Receive events from Claude Code hook |
| `/api/windows` | GET | List all windows with panes |
| `/api/windows/create` | POST | Create new tmux window (body: `{ sessionName, windowName? }`) |
| `/api/windows/:id/rename` | POST | Rename window (body: `{ windowName }`, enforces unique names per session) |
| `/api/windows/:id/close` | POST | Close/kill tmux window |
| `/api/windows/:id/new-pane` | POST | Split new pane in window |
| `/api/windows/:id/new-claude` | POST | Split new pane and start Claude Code |
| `/api/panes/:id/prompt` | POST | Send prompt/input to pane |
| `/api/panes/:id/signal` | POST | Send signal (e.g., SIGINT for Ctrl+C) |
| `/api/panes/:id/dismiss` | POST | Dismiss waiting status (set to ready) |
| `/api/panes/:id/refresh` | POST | Refresh pane (scroll to bottom, reset state) |
| `/api/panes/:id/close` | POST | Close/kill pane |
| `/api/companions` | GET | List all companions (XP/stats/achievements) |
| `/api/companions/:id/prompt` | POST | Send prompt to companion's active Claude pane |
| `/api/competitions` | GET | All categories, all time periods |
| `/api/quests` | GET | List all quests |
| `/api/quests` | POST | Create quest (internal, from skill events) |
| `/api/quests/:id` | PATCH | Update quest status (body: `{ status }`) |
| `/api/transcribe` | POST | Transcribe audio via whisper.cpp |
| `/api/avatars/:seed` | GET | Serve cached Bitcoin face avatar SVG |
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

### WebSocket Heartbeat

The server implements a ping/pong heartbeat mechanism to keep connections alive through reverse proxies and Cloudflare tunnels:

- Server sends ping every 30s (configurable via `wsHeartbeatInterval`)
- Tracks last pong time from each client
- Closes stale connections after 90s of no response
- Prevents silent connection timeouts (especially through tunnels which timeout after ~100s of inactivity)
