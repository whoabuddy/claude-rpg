# Claude RPG Server v2

Bun-native server with SQLite storage, domain-driven architecture, and real-time WebSocket updates.

## Quick Start

```bash
# Development (with watch)
npm run dev:v2

# Production
npm run start:v2

# Tests
npm run test:v2

# Type check
npm run typecheck:v2
```

## Architecture

```
server-v2/
├── lib/              # Core utilities
│   ├── config.ts     # Environment configuration
│   ├── logger.ts     # Structured JSON logging
│   └── shutdown.ts   # Graceful shutdown handling
├── db/               # SQLite database
│   ├── schema.ts     # Table definitions
│   ├── migrations.ts # Version-tracked migrations
│   ├── queries.ts    # Prepared statements
│   └── index.ts      # Connection management
├── events/           # Event bus
│   ├── types.ts      # 22 event types
│   ├── bus.ts        # Pub/sub with priority
│   └── hooks.ts      # Claude Code hook processing
├── tmux/             # Tmux integration
│   ├── types.ts      # Pane, Window, Session types
│   ├── process.ts    # Process detection via /proc
│   ├── commands.ts   # Tmux command wrappers
│   └── poller.ts     # State polling
├── terminal/         # Terminal parsing
│   ├── patterns.ts   # Regex pattern registry
│   └── parser.ts     # State detection
├── sessions/         # Claude session management
│   ├── state-machine.ts  # Session state transitions
│   ├── reconciler.ts     # Hook vs terminal reconciliation
│   └── manager.ts        # Session lifecycle
├── personas/         # Claude identities
│   ├── names.ts      # Name generation
│   ├── avatar.ts     # Bitcoin faces integration
│   └── service.ts    # CRUD operations
├── projects/         # Git repositories
│   ├── git.ts        # Git detection and info
│   └── service.ts    # CRUD operations
├── xp/               # Experience points
│   ├── calculator.ts # XP values per event
│   ├── levels.ts     # Level progression
│   └── ledger.ts     # XP tracking
├── quests/           # Quest system
│   ├── state-machine.ts  # Quest/phase transitions
│   └── service.ts        # Quest lifecycle
├── achievements/     # Achievement system
│   ├── definitions.ts    # 24 achievements
│   └── checker.ts        # Unlock detection
├── api/              # HTTP/WebSocket
│   ├── routes.ts     # Route definitions
│   ├── handlers.ts   # Request handlers
│   ├── broadcast.ts  # WebSocket with backpressure
│   └── messages.ts   # Message types
└── index.ts          # Main entry point
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4011` | HTTP/WebSocket port |
| `CLAUDE_RPG_DATA_DIR` | `~/.claude-rpg` | Data directory |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `POLL_INTERVAL` | `250` | Tmux polling interval (ms) |
| `WS_HEARTBEAT_INTERVAL` | `30000` | WebSocket heartbeat (ms) |

## API Endpoints

### Health
- `GET /health` - Server health check

### Events
- `POST /event` - Receive Claude Code hook events

### Windows
- `GET /api/windows` - List all windows with panes
- `POST /api/windows/create` - Create new window
- `POST /api/windows/:id/rename` - Rename window
- `POST /api/windows/:id/close` - Close window
- `POST /api/windows/:id/new-pane` - Create pane
- `POST /api/windows/:id/new-claude` - Create pane with Claude

### Panes
- `POST /api/panes/:id/prompt` - Send prompt
- `POST /api/panes/:id/signal` - Send signal
- `POST /api/panes/:id/dismiss` - Dismiss waiting
- `POST /api/panes/:id/refresh` - Refresh pane
- `POST /api/panes/:id/close` - Close pane

### Personas
- `GET /api/personas` - List all personas
- `GET /api/personas/:id` - Get persona details

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details

### Quests
- `GET /api/quests` - List active quests
- `GET /api/quests/:id` - Get quest details
- `PATCH /api/quests/:id` - Update quest status

### XP
- `GET /api/xp/summary?type=persona&id=xxx` - XP by category
- `GET /api/xp/timeline?type=persona&id=xxx&days=30` - XP timeline

## WebSocket Messages

Connect to `ws://localhost:4011` to receive real-time updates.

### Server → Client

| Type | Priority | Description |
|------|----------|-------------|
| `connected` | - | Initial connection |
| `windows` | normal | All windows/panes state |
| `pane_update` | high | Single pane changed |
| `pane_removed` | high | Pane closed |
| `personas` | normal | All personas |
| `persona_update` | normal | Persona XP/status changed |
| `projects` | normal | All projects |
| `project_update` | normal | Project activity |
| `quests` | normal | All quests |
| `quest_update` | normal | Quest status changed |
| `xp_gain` | normal | XP awarded |
| `event` | low | Hook event received |
| `terminal_output` | low | Terminal content |
| `error` | high | Error occurred |

### Backpressure

When client buffer exceeds 64KB:
- High priority: always sent
- Normal priority: paused
- Low priority: dropped

Resumes when buffer drops below 16KB.

## Session State Machine

```
idle → typing → working → waiting → error
 ↑       ↓        ↓         ↓        ↓
 └───────┴────────┴─────────┴────────┘
```

Valid transitions:
- `idle` → typing, working, waiting, error
- `typing` → idle, working, waiting, error
- `working` → idle, waiting, error
- `waiting` → idle, typing, working, error
- `error` → idle, working, waiting

## Quest State Machine

```
planned → active → completed → archived
           ↓↑        ↓
         paused    failed → archived
```

## Development

```bash
# Run tests
bun test server-v2

# Run specific test file
bun test server-v2/__tests__/xp/calculator.test.ts

# Watch mode
bun test --watch server-v2
```

## Database

SQLite with WAL mode. Location: `$CLAUDE_RPG_DATA_DIR/claude-rpg-v2.db`

Tables:
- `personas` - Claude session identities
- `projects` - Git repositories
- `xp_events` - XP ledger
- `stats` - Aggregated statistics
- `quests` - Quest tracking
- `achievements` - Unlocked achievements
- `events` - Recent hook events (ring buffer)
- `schema_version` - Migration tracking
