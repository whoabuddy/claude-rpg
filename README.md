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

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CLAUDE_RPG_PORT` | 4011 | Server port |
| `CLAUDE_RPG_CLIENT_PORT` | 4010 | Vite dev server port |

For detailed setup including HTTPS certificates, voice input, and mobile access, see **[SETUP.md](./SETUP.md)**.

## Development

```bash
npm run dev          # Start dev server (:4012) + Vite client (:4010)
npm run dev:server   # Dev server only
npm run dev:client   # Vite client only
npm run build        # Production build
npm run start        # Run production server (:4011)
npm run deploy       # Build + restart systemd service
npm run typecheck    # Type check
```

For production deployment with systemd and Cloudflare tunnel, see [deploy/README.md](./deploy/README.md).

## Updating Terminal Patterns

Terminal patterns detect Claude Code's state from terminal output. When Claude Code updates its UI, patterns may need updating.

### When to Update

Check patterns after any Claude Code release that mentions:
- Terminal UI changes
- New prompt styles
- Spinner/progress indicator changes
- Error message formatting

### Update Procedure

1. **Capture Real Output**
   ```bash
   # Run Claude Code and capture terminal
   tmux capture-pane -p -t <pane> > new-output.txt
   ```

2. **Test Against Current Patterns**
   ```bash
   bun run test:patterns
   ```

3. **Update Patterns**

   Edit `server-v2/terminal/patterns.ts`:
   - Add new pattern or update regex
   - Adjust confidence if needed
   - Add comment with Claude Code version

4. **Create New Pattern Version**

   Edit `server-v2/terminal/pattern-registry.ts`:
   - Increment version
   - Set claudeCodeVersion
   - Add new pattern set

5. **Add Test Fixture**

   Save real output to `server-v2/terminal/test-fixtures/`:
   - Name: `<type>-<description>.txt`
   - Include 50+ lines of context
   - Add header comment documenting source

6. **Validate**
   ```bash
   bun test server-v2/__tests__/terminal/
   ```

### Pattern Confidence Guidelines

- **0.9+**: Highly specific (exact tool names, unique UI elements)
- **0.7-0.9**: Specific but common (permission prompts, plan mode)
- **0.5-0.7**: Generic indicators (spinners, "Working...")
- **0.4-0.5**: Weak signals (checkmarks, shell prompts)
- **<0.4**: Very generic (avoid false positives)

Multiple weak patterns (0.5 each) can boost confidence via scoring algorithm.

## License

MIT
