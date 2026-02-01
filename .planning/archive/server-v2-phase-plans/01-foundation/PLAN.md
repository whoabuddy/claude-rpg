# Phase 1: Foundation

## Goal
Set up Bun server foundation with SQLite database, structured logging, and graceful shutdown.

## Context
- Fresh rewrite in `server-v2/` directory
- Bun for runtime, WebSocket, SQLite, tests
- Server is core infrastructure, client and LLM are consumers
- Issues: #115, #116

<plan>
  <goal>Initialize Bun server with SQLite, logging, and graceful shutdown</goal>
  <context>
    - Bun's native SQLite: `import { Database } from 'bun:sqlite'`
    - Bun.serve() for HTTP + WebSocket in one
    - TypeScript strict mode for type safety
    - Existing server in server/ for reference patterns
  </context>

  <task id="1">
    <name>Create server-v2 directory structure and config</name>
    <files>server-v2/index.ts, server-v2/bunfig.toml, server-v2/tsconfig.json, server-v2/lib/config.ts</files>
    <action>
      1. Create server-v2/ directory
      2. Create bunfig.toml with server settings
      3. Create tsconfig.json with strict mode, ESNext target
      4. Create lib/config.ts with:
         - PORT (default 4011)
         - DATA_DIR (default ~/.claude-rpg)
         - LOG_LEVEL (default 'info')
         - POLL_INTERVAL (default 250)
      5. Create index.ts as slim entrypoint that imports and starts server
    </action>
    <verify>
      bun run server-v2/index.ts --help (or just check it compiles)
      Check tsconfig.json has strict: true
    </verify>
    <done>Directory structure exists, config loads from environment</done>
  </task>

  <task id="2">
    <name>Implement SQLite database with schema and migrations</name>
    <files>server-v2/db/index.ts, server-v2/db/schema.ts, server-v2/db/migrations.ts, server-v2/db/queries.ts</files>
    <action>
      1. Create db/index.ts:
         - Initialize Database from bun:sqlite
         - Enable WAL mode for performance
         - Enable foreign keys
         - Export db instance
      2. Create db/schema.ts with table definitions:
         - personas (id, name, avatar_svg, total_xp, level, created_at, last_seen_at)
         - projects (id, path, name, github_url, total_xp, level, created_at, last_activity_at)
         - xp_events (id, persona_id, project_id, event_type, xp_amount, metadata, created_at)
         - stats (id, entity_type, entity_id, stat_path, value)
         - quests (id, project_id, title, description, status, phases, xp_awarded, created_at, completed_at)
         - achievements (id, entity_type, entity_id, achievement_id, unlocked_at)
         - events (id, event_id, pane_id, persona_id, project_id, event_type, tool_name, payload, created_at)
      3. Create db/migrations.ts:
         - Version tracking table (schema_version)
         - Migration runner that applies pending migrations
         - Log migration progress
      4. Create db/queries.ts:
         - Prepared statements for common queries
         - Type-safe query helpers
         - Transaction wrapper
    </action>
    <verify>
      bun run server-v2/db/index.ts (should create DB file)
      Check schema_version table exists
      Check all tables created with correct columns
    </verify>
    <done>SQLite database initializes with all tables and migrations</done>
  </task>

  <task id="3">
    <name>Implement structured logging and graceful shutdown</name>
    <files>server-v2/lib/logger.ts, server-v2/lib/shutdown.ts, server-v2/index.ts</files>
    <action>
      1. Create lib/logger.ts:
         - Log levels: debug, info, warn, error
         - JSON format with timestamp, level, module, message
         - Configurable via LOG_LEVEL env
         - Export createLogger(module) factory
      2. Create lib/shutdown.ts:
         - Register shutdown handlers
         - Handle SIGTERM, SIGINT
         - Run handlers in order (close WS, flush DB, close DB)
         - Timeout after 10s
         - Exit with appropriate code
      3. Update index.ts:
         - Import config, logger, shutdown
         - Initialize database
         - Register DB close as shutdown handler
         - Start HTTP server placeholder
         - Log startup message
    </action>
    <verify>
      bun run server-v2/index.ts (should start and log)
      Send SIGTERM (should log shutdown and exit cleanly)
    </verify>
    <done>Server starts with logging, shuts down gracefully on SIGTERM</done>
  </task>
</plan>

## Verification Criteria
- [ ] `bun run server-v2/index.ts` starts without errors
- [ ] SQLite database created at configured path
- [ ] All tables exist with proper schema
- [ ] Logging outputs JSON with module context
- [ ] SIGTERM triggers graceful shutdown
- [ ] TypeScript compiles with strict mode
