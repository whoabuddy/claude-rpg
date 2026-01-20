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
Claude Code → Hook Script → Server → WebSocket → React UI
                              ↓
                         companions.json (projects + sessions)
                         events.jsonl (history)
                              ↓
                         Bitcoin Faces API (avatar SVGs)
```

### Key Concepts

- **Companion** = Git repo = Project with RPG progression (level, XP, stats)
- **Session** = Unit of work = Individual Claude Code session within a project
  - Gets an English first name (deterministic from session ID)
  - Gets a Bitcoin face avatar from bitcoinfaces.xyz
  - Tracks status: idle, working, waiting (for user input), error
- **CWD** from Claude events → maps to repo → maps to companion
- **XP** from Claude tools + git commands + dev commands (tests, builds, deploys)

## Project Structure

```
claude-rpg/
├── server/           # Node.js WebSocket server
│   ├── index.ts      # Main server, event processing, session management
│   ├── companions.ts # Companion/session CRUD, git repo detection, Bitcoin faces
│   ├── xp.ts         # XP calculation, command detection
│   └── cli.ts        # CLI for setup and running
├── src/              # React + Tailwind frontend
│   ├── components/   # UI components (CompanionDetail, SessionCard, etc.)
│   ├── hooks/        # React hooks (WebSocket, companions)
│   └── styles/       # Tailwind CSS
├── shared/           # Shared types between server/client
│   ├── types.ts      # TypeScript interfaces (Companion, Session, etc.)
│   └── defaults.ts   # Configuration defaults
└── hooks/            # Claude Code hook script
    └── claude-rpg-hook.sh
```

## Data Flow

1. Claude Code runs in a git repo
2. Hook script captures events (tool use, prompts, etc.)
3. Hook adds `tmuxTarget` and `timestamp`, sends to server
4. Server matches CWD to companion (auto-creates if new repo)
5. Server finds/creates session within companion (by session ID)
6. On new session: fetches Bitcoin face SVG, assigns English name
7. Server detects special events (AskUserQuestion → waiting status)
8. Server calculates XP based on event type
9. Server broadcasts to WebSocket clients
10. React UI updates in real-time (sessions, terminal output, questions)

## Session Management

Sessions are tracked within companions and represent individual Claude Code instances:

```typescript
interface Session {
  id: string              // Claude session UUID
  name: string            // English first name (deterministic from ID hash)
  avatarSvg?: string      // Cached Bitcoin face SVG
  status: SessionStatus   // idle | working | waiting | error
  tmuxTarget?: string     // For terminal capture and prompt sending
  pendingQuestion?: PendingQuestion  // When AskUserQuestion is active
  currentTool?: string
  currentFile?: string
  createdAt: number
  lastActivity: number
}
```

**AskUserQuestion Handling:**
- Detected from `PreToolUse` events with `tool: 'AskUserQuestion'`
- Session status set to `waiting`
- Question and options stored in `pendingQuestion`
- UI displays clickable answer buttons + custom input field
- Answering clears the question and resumes session

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

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/event` | POST | Receive events from hook |
| `/api/companions` | GET | List all companions |
| `/api/companions/:id/prompt` | POST | Send prompt to most recent session |
| `/api/companions/:id/sessions/:sessionId/prompt` | POST | Send prompt to specific session |

## WebSocket Messages

**Server → Client:**
- `connected` - Initial connection
- `companions` - All companions on connect
- `companion_update` - Single companion changed (includes sessions)
- `event` - New Claude event
- `xp_gain` - XP was awarded
- `history` - Recent events on connect
- `terminal_output` - Terminal content for a session (polled every 500ms)

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CLAUDE_RPG_PORT` | 4011 | Server port |
| `CLAUDE_RPG_CLIENT_PORT` | 4010 | Vite dev server port |
| `CLAUDE_RPG_DATA_DIR` | ~/.claude-rpg/data | Data directory |

## Files

| File | Purpose |
|------|---------|
| `~/.claude-rpg/data/companions.json` | Companion definitions + sessions + stats |
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

## Adding New Command XP

Edit `server/xp.ts`:

```typescript
// In detectCommandXP()
if (cmd.includes('your-command')) {
  return { type: 'commands.custom', xp: 5, statKey: 'commands.customRun' }
}
```

Then add the stat key to the `CompanionStats` interface in `shared/types.ts`.

## Mobile-First Design

- Tailwind with custom RPG color palette
- Touch-friendly tap targets (min 44px)
- Auto-resizing textarea for prompt input
- Session cards with Bitcoin face avatars
- Clickable answer buttons for AskUserQuestion
- Terminal output per session
- XP bar animations

## Future Work

- [ ] Voice input (Whisper)
- [ ] Push notifications (PWA)
- [ ] Level-up animations
- [ ] Achievement system
- [ ] tmux focus sync (web ↔ TUI)
- [ ] Session cleanup (remove stale sessions)
