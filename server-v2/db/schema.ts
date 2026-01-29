/**
 * SQLite schema definitions
 */

export const SCHEMA_VERSION = 1

/**
 * SQL statements to create all tables
 */
export const CREATE_TABLES = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- Personas: Claude sessions with identity
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_svg TEXT,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personas_name ON personas(name);
CREATE INDEX IF NOT EXISTS idx_personas_last_seen ON personas(last_seen_at);

-- Projects: Git repositories
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  github_url TEXT,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- XP Ledger: Every XP award tracked
CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id TEXT REFERENCES personas(id),
  project_id TEXT REFERENCES projects(id),
  event_type TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_xp_events_persona ON xp_events(persona_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_project ON xp_events(project_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_type ON xp_events(event_type);
CREATE INDEX IF NOT EXISTS idx_xp_events_created ON xp_events(created_at);

-- Stats: Aggregated statistics
CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  stat_path TEXT NOT NULL,
  value INTEGER DEFAULT 0,
  UNIQUE(entity_type, entity_id, stat_path)
);

CREATE INDEX IF NOT EXISTS idx_stats_entity ON stats(entity_type, entity_id);

-- Quests: Active and completed quests
CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  phases TEXT NOT NULL,
  xp_awarded INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_quests_project ON quests(project_id);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);

-- Achievements: Unlocked achievements
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  UNIQUE(entity_type, entity_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_achievements_entity ON achievements(entity_type, entity_id);

-- Events: Recent Claude events (ring buffer, cleaned periodically)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE,
  pane_id TEXT NOT NULL,
  persona_id TEXT REFERENCES personas(id),
  project_id TEXT REFERENCES projects(id),
  event_type TEXT NOT NULL,
  tool_name TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_pane ON events(pane_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
`

/**
 * Table names for reference
 */
export const TABLES = [
  'schema_version',
  'personas',
  'projects',
  'xp_events',
  'stats',
  'quests',
  'achievements',
  'events',
] as const

export type TableName = typeof TABLES[number]
