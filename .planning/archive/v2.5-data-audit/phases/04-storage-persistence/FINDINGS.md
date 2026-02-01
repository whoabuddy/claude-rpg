# Phase 4: Storage and Persistence Audit - Findings

**Audit Date:** 2026-01-31
**Phase Status:** Completed

## Executive Summary

The claude-rpg system uses a **dual-layer storage model**: SQLite for persistent data (XP, stats, personas, projects, quests, achievements) and in-memory Maps for ephemeral runtime state (active sessions, terminal content, timestamps). This design prioritizes performance for real-time data while ensuring long-term data survives restarts. However, the lack of synchronization between layers creates **staleness risks** and potential **data integrity concerns**.

---

## 1. SQLite Schema Overview

**Database location:** `~/.claude-rpg/claude-rpg-v2.db`
**Schema version:** 6 (with migrations)
**Mode:** WAL (Write-Ahead Logging) for better performance

### Table Summary

| Table | Purpose | Survives Restart | Update Frequency |
|-------|---------|------------------|------------------|
| `schema_version` | Migration tracking | Yes | On migration only |
| `personas` | Claude session identities | Yes | Per session, per XP event |
| `projects` | Git repositories | Yes | Per activity event |
| `xp_events` | XP ledger (append-only) | Yes | Per tool use |
| `stats` | Aggregated statistics | Yes | Per tool use, per command |
| `quests` | Quest tracking | Yes | Per phase transition |
| `achievements` | Unlocked achievements | Yes | On achievement unlock |
| `events` | Recent hook events (ring buffer) | Yes | Per hook event |
| `notes` | Scratchpad entries | Yes | User-initiated |
| `persona_challenges` | Daily/weekly challenges | Yes | Per challenge update |

### Detailed Table Schemas

**personas** (Claude session identities)
```sql
id TEXT PRIMARY KEY
session_id TEXT NOT NULL UNIQUE    -- Claude Code session ID
name TEXT NOT NULL                 -- Generated English name
avatar_url TEXT                    -- Bitcoin face avatar URL
status TEXT DEFAULT 'active'       -- 'active' | 'dormant'
total_xp INTEGER DEFAULT 0         -- Cumulative XP
level INTEGER DEFAULT 1            -- Calculated from XP
badges TEXT DEFAULT '[]'           -- JSON array of earned badges
energy INTEGER DEFAULT 100         -- Health: energy (0-100)
morale INTEGER DEFAULT 100         -- Health: morale (0-100)
health_updated_at TEXT             -- Last health update
created_at TEXT NOT NULL
last_seen_at TEXT NOT NULL
```

**projects** (Git repositories = Companions)
```sql
id TEXT PRIMARY KEY
path TEXT NOT NULL UNIQUE          -- Filesystem path
name TEXT NOT NULL                 -- Repo name
github_url TEXT                    -- GitHub remote URL
project_class TEXT DEFAULT 'unknown' -- 'frontend'|'backend'|'fullstack'|'blockchain'|'infra'|'unknown'
total_xp INTEGER DEFAULT 0
level INTEGER DEFAULT 1
current_streak INTEGER DEFAULT 0   -- Days in a row with activity
longest_streak INTEGER DEFAULT 0
last_streak_date TEXT              -- YYYY-MM-DD
created_at TEXT NOT NULL
last_activity_at TEXT NOT NULL
```

**xp_events** (XP Ledger - append-only audit trail)
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
persona_id TEXT REFERENCES personas(id)
project_id TEXT REFERENCES projects(id)
event_type TEXT NOT NULL           -- 'tool:Edit', 'tool:Bash', etc.
xp_amount INTEGER NOT NULL
metadata TEXT                      -- JSON: {toolName, success, paneId}
created_at TEXT NOT NULL
```

**stats** (Aggregated statistics)
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
entity_type TEXT NOT NULL          -- 'persona' | 'project'
entity_id TEXT NOT NULL
stat_path TEXT NOT NULL            -- e.g., 'toolsUsed.Edit', 'git.commits'
value INTEGER DEFAULT 0
UNIQUE(entity_type, entity_id, stat_path)
```

**quests** (Quest tracking)
```sql
id TEXT PRIMARY KEY
project_id TEXT REFERENCES projects(id)
title TEXT NOT NULL
description TEXT
status TEXT NOT NULL               -- 'planned'|'active'|'completed'|'abandoned'
phases TEXT NOT NULL               -- JSON array of QuestPhase objects
xp_awarded INTEGER DEFAULT 0
created_at TEXT NOT NULL
started_at TEXT
completed_at TEXT
```

**achievements** (Unlocked achievements)
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
entity_type TEXT NOT NULL          -- 'persona' | 'project'
entity_id TEXT NOT NULL
achievement_id TEXT NOT NULL
unlocked_at TEXT NOT NULL
UNIQUE(entity_type, entity_id, achievement_id)
```

**events** (Recent hook events - ring buffer for history)
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
event_id TEXT UNIQUE               -- Deduplication key
pane_id TEXT NOT NULL
persona_id TEXT REFERENCES personas(id)
project_id TEXT REFERENCES projects(id)
event_type TEXT NOT NULL           -- 'pre_tool_use'|'post_tool_use'|'stop'|etc.
tool_name TEXT
payload TEXT                       -- JSON of full event data
created_at TEXT NOT NULL
```

**notes** (Scratchpad entries)
```sql
id TEXT PRIMARY KEY
content TEXT NOT NULL
tags TEXT                          -- JSON array of strings
status TEXT DEFAULT 'inbox'        -- 'inbox'|'active'|'done'|'archived'
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

**persona_challenges** (Daily/weekly challenges)
```sql
id TEXT PRIMARY KEY
persona_id TEXT NOT NULL REFERENCES personas(id)
challenge_id TEXT NOT NULL
period TEXT NOT NULL               -- 'daily' | 'weekly'
status TEXT DEFAULT 'active'       -- 'active'|'completed'|'expired'
progress INTEGER DEFAULT 0
target INTEGER NOT NULL
xp_reward INTEGER NOT NULL
assigned_at TEXT NOT NULL
expires_at TEXT NOT NULL
completed_at TEXT
```

---

## 2. In-Memory Caches

### Session Manager (`server-v2/sessions/manager.ts`)

```typescript
// Primary session cache - keyed by pane ID
const sessions = new Map<string, ClaudeSession>()

// Content change tracking for reconciliation
const terminalChangeTimestamps = new Map<string, number>()
```

**ClaudeSession structure (in-memory only):**
```typescript
interface ClaudeSession {
  id: string                       // UUID generated on creation
  paneId: string                   // Tmux pane ID
  personaId: string | null         // Links to DB persona
  projectId: string | null         // Links to DB project
  status: SessionStatus            // 'idle'|'typing'|'working'|'waiting'|'error'
  statusSource: 'hook' | 'terminal' | 'reconciler'
  statusChangedAt: string          // ISO timestamp
  lastActivityAt: string           // ISO timestamp
  terminalContent?: string         // Last captured terminal output
  terminalConfidence?: number      // Parser confidence (0-1)
  lastError?: SessionError         // Most recent error details
}
```

### Tmux Poller (`server-v2/tmux/poller.ts`)

```typescript
// Adaptive polling rate tracking
const lastPaneCapture = new Map<string, number>()         // Last capture timestamp
const lastContentChange = new Map<string, number>()       // Last content change
const consecutiveNoChange = new Map<string, number>()     // Backoff counter
const lastTerminalContent = new Map<string, string>()     // Content cache for diffing
```

**Adaptive intervals:**
- Active (changed <2s): 250ms
- Working/waiting: 500ms
- Idle: 2000ms
- Backoff (5+ no-changes): 5000ms

### Config Singleton (`server-v2/lib/config.ts`)

```typescript
let _config: Config | null = null  // Loaded from env on first access
```

---

## 3. Data Survival Matrix

### Data That Survives Server Restart

| Data Type | Storage | Recovery Behavior |
|-----------|---------|-------------------|
| Personas (name, avatar, XP, level) | SQLite | Automatically loaded on persona lookup |
| Projects (path, stats, level) | SQLite | Automatically loaded on project lookup |
| XP ledger | SQLite | Immutable history - always available |
| Aggregated stats | SQLite | Always current (upsert pattern) |
| Quests and phases | SQLite | Status preserved exactly |
| Achievements | SQLite | Preserved; checks prevent re-unlocking |
| Notes | SQLite | Preserved exactly |
| Challenges | SQLite | Preserved; expired ones stay expired |

### Data Lost on Server Restart

| Data Type | Storage | Impact |
|-----------|---------|--------|
| Active session status | Memory | All sessions show as idle on restart |
| Terminal content | Memory | No terminal history after restart |
| Error state (lastError) | Memory | Errors cleared; no sticky errors |
| Terminal change timestamps | Memory | Reconciliation timing reset |
| Adaptive polling state | Memory | All panes restart at normal intervals |

---

## 4. Data Flow: Memory to Database

### XP Recording Flow

```
PostToolUseEvent (hook)
    |
    v
calculateXp(eventType) -----> XP amount
    |
    v
recordXpEvent() -----> INSERT INTO xp_events (append-only)
    |
    v
addXp(personaId) -----> UPDATE personas SET total_xp = total_xp + ?
    |
    v
calculateLevel() -----> UPDATE personas SET level = ? (if changed)
    |
    v
checkBadges() -----> UPDATE personas SET badges = ? (if new badges)
```

**Key observation:** XP is written immediately to DB. No in-memory accumulation.

### Stats Recording Flow

```
PostToolUseEvent (hook)
    |
    v
incrementStat(projectId, statPath)
    |
    v
queries.upsertStat.run() -----> INSERT OR UPDATE stats table
```

**Key observation:** Stats are written atomically with UPSERT. No batch accumulation.

### Session Status Flow

```
Hook Event (pre_tool_use, post_tool_use, stop)
    |
    v
updateFromHook(paneId, status)  [MEMORY]
    |
    v
sessions.set(paneId, session)   [MEMORY ONLY]
    |
    v
eventBus.emit(session:status_changed)
    |
    v
Discord notification (external)
WebSocket broadcast (clients)
```

**Key observation:** Session status is NEVER persisted to DB. It's purely ephemeral.

---

## 5. Staleness Risks

### Risk 1: Memory/DB Persona Desync

**Scenario:** Session manager holds `session.personaId` but persona may have been modified by another process (e.g., admin script, migration).

**Current behavior:** No cache invalidation. Persona is re-fetched from DB on each `getPersonaById()` call, mitigating this risk.

**Assessment:** LOW RISK - Database is source of truth, fetched on each access.

### Risk 2: Terminal Content Cache Staleness

**Scenario:** Terminal content is cached in `lastTerminalContent` Map. If a pane ID is reused after a pane close/reopen, stale content may be compared.

**Current behavior:** `cleanupPaneTracking(paneId)` is called when panes are removed.

**Assessment:** MEDIUM RISK - Relies on correct cleanup. If cleanup is missed, could affect reconciliation.

### Risk 3: Session Status Not Persisted

**Scenario:** Server restarts while Claude is actively working. On restart, session shows as idle because status is memory-only.

**Current behavior:** No persistence. Hooks will eventually update status when Claude sends next event.

**Assessment:** LOW RISK for correctness (will self-correct), HIGH RISK for user experience (momentary wrong state).

### Risk 4: Error State Lost on Restart

**Scenario:** Server restarts while a session has an error. Error details are lost.

**Current behavior:** `lastError` is memory-only. No DB persistence.

**Assessment:** LOW RISK - Errors are transient by design. Phase 3 identified that errors may even be retained TOO long in memory.

### Risk 5: Stats Race Condition

**Scenario:** Concurrent tool uses could cause stat increment race conditions.

**Current behavior:** SQLite UPSERT is atomic (`value = value + excluded.value`). Each increment is a separate transaction.

**Assessment:** LOW RISK - SQLite's atomic UPSERT handles concurrency correctly.

### Risk 6: Streak Calculation Race

**Scenario:** Multiple tool uses on same day could incorrectly increment streak.

**Current behavior:** `updateStreak()` runs in a transaction and checks `lastDate === today` before incrementing.

**Assessment:** LOW RISK - Transaction and date check prevent double-counting.

---

## 6. Data Integrity Concerns

### Concern 1: Orphaned XP Events

**Scenario:** Persona or project is deleted but xp_events reference it.

**Current behavior:** Foreign keys are defined but no CASCADE DELETE. Orphaned events could accumulate.

**Impact:** Low - events are historical record. Aggregation queries filter by entity.

### Concern 2: Events Table Growth

**Scenario:** Events table grows unboundedly over time.

**Current behavior:** `deleteOldEvents` query exists but no scheduled cleanup found.

**Impact:** Medium - DB file will grow. No automatic ring-buffer enforcement.

**Location:** `queries.deleteOldEvents` in `server-v2/db/index.ts`

### Concern 3: No Backup Strategy

**Current behavior:** No automated backups. Single SQLite file at `~/.claude-rpg/claude-rpg-v2.db`.

**Impact:** Data loss risk on disk failure or corruption.

### Concern 4: Schema Migrations Are Not Reversible

**Current behavior:** Migrations run forward only. No rollback mechanism.

**Impact:** Risky schema changes could corrupt data with no recovery path.

---

## 7. Comparison with Legacy Server

The legacy server (`server/`) had a similar dual-layer model but with some differences:

| Aspect | Legacy (v1) | Current (v2) |
|--------|-------------|--------------|
| Database | `claude-rpg.db` | `claude-rpg-v2.db` |
| Session storage | Memory Map | Memory Map (same) |
| XP tracking | Same pattern | Same pattern |
| Error timeout | 10s staleness check in reconciler | Missing (Phase 3 finding) |
| Terminal caching | Fixed interval | Adaptive interval (improved) |
| Prepared statements | Created per-query | Pre-compiled at init (improved) |

---

## 8. Recommendations for Phase 6 Review

### Priority 1: Add Events Table Cleanup

Implement scheduled cleanup for the events table to prevent unbounded growth:
- Either periodic job (e.g., delete events older than 7 days)
- Or enforce row limit (e.g., keep last 10000 events)

### Priority 2: Consider Session Status Persistence

For better UX after restarts, could optionally persist:
- Last known status per pane ID
- Clear on startup or after 5 minutes of no activity

**Trade-off:** Adds complexity, may show stale status. Current "always idle on restart" is simpler.

### Priority 3: Add Database Backup Reminder

Either:
- Document manual backup procedure
- Add automatic backup before migrations
- Implement WAL checkpoint before backup

### Priority 4: Monitor DB Size

Add logging for:
- Database file size on startup
- Row counts for key tables
- Alert if events table exceeds threshold

### Questions for Human Checkpoint

1. Should the events table have a retention policy? (e.g., 7 days, 10000 rows)
2. Is the "always idle on restart" behavior acceptable, or should we persist session status?
3. Should XP events be kept forever (full audit trail) or pruned after N months?
4. Is the current WAL mode appropriate, or should we use different journal mode?
5. Should we add automated database backups?

---

## Appendix: Key File References

| Purpose | File | Key Code |
|---------|------|----------|
| Schema definition | `server-v2/db/schema.ts` | `CREATE_TABLES`, `TABLES` |
| Migrations | `server-v2/db/migrations.ts` | `MIGRATIONS` array |
| Database init | `server-v2/db/index.ts` | `initDatabase()`, prepared statements |
| Query helpers | `server-v2/db/queries.ts` | Type-safe query builders |
| Session cache | `server-v2/sessions/manager.ts` | `sessions` Map |
| Terminal cache | `server-v2/tmux/poller.ts` | `lastTerminalContent` Map |
| XP recording | `server-v2/xp/ledger.ts` | `recordXpEvent()` |
| Stats tracking | `server-v2/companions/service.ts` | `incrementStat()`, `updateStreak()` |
| Persona service | `server-v2/personas/service.ts` | CRUD operations |
| Project service | `server-v2/projects/service.ts` | CRUD operations |
| Quest service | `server-v2/quests/service.ts` | Quest state management |
| Achievement checker | `server-v2/achievements/checker.ts` | Achievement validation |
| Notes service | `server-v2/notes/service.ts` | Notes CRUD |
| Config | `server-v2/lib/config.ts` | Data directory location |
