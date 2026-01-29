/**
 * Database initialization and connection
 */

import { Database, Statement } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { getConfig } from '../lib/config'
import { createLogger } from '../lib/logger'
import { onShutdown } from '../lib/shutdown'
import { runMigrations } from './migrations'

const log = createLogger('database')

let _db: Database | null = null

/**
 * Prepared statements for all queries
 */
export interface Queries {
  // Personas
  insertPersona: Statement
  getPersonaById: Statement
  getPersonaBySessionId: Statement
  getAllPersonas: Statement
  getActivePersonas: Statement
  updatePersonaLastSeen: Statement
  updatePersonaStatus: Statement
  addPersonaXp: Statement
  updatePersonaLevel: Statement
  updatePersonaBadges: Statement

  // Projects
  insertProject: Statement
  getProjectById: Statement
  getProjectByPath: Statement
  getAllProjects: Statement
  getActiveProjects: Statement
  updateProjectLastActivity: Statement
  addProjectXp: Statement
  updateProjectLevel: Statement

  // XP Events
  insertXpEvent: Statement
  getXpEventsByPersona: Statement
  getXpEventsByProject: Statement

  // Stats
  upsertStat: Statement
  getStat: Statement
  getStatsByEntity: Statement

  // Quests
  insertQuest: Statement
  getQuestById: Statement
  getQuestsByStatus: Statement
  getQuestsByProject: Statement
  updateQuestStatus: Statement
  updateQuestPhases: Statement
  completeQuest: Statement

  // Achievements
  insertAchievement: Statement
  getAchievementsByEntity: Statement
  achievementExists: Statement
  getRecentAchievements: Statement

  // Events
  insertEvent: Statement
  getRecentEvents: Statement
  deleteOldEvents: Statement

  // Notes
  insertNote: Statement
  getNoteById: Statement
  getAllNotes: Statement
  getNotesByStatus: Statement
  updateNote: Statement
  deleteNote: Statement
}

let _queries: Queries | null = null

/**
 * Get database file path
 */
export function getDatabasePath(): string {
  const config = getConfig()
  return join(config.dataDir, 'claude-rpg-v2.db')
}

/**
 * Initialize and return database instance
 */
export function initDatabase(): Database {
  if (_db) {
    return _db
  }

  const dbPath = getDatabasePath()
  const dbDir = dirname(dbPath)

  // Ensure data directory exists
  if (!existsSync(dbDir)) {
    log.info('Creating data directory', { path: dbDir })
    mkdirSync(dbDir, { recursive: true })
  }

  log.info('Opening database', { path: dbPath })

  _db = new Database(dbPath, { create: true })

  // Enable WAL mode for better performance
  _db.exec('PRAGMA journal_mode = WAL')

  // Enable foreign keys
  _db.exec('PRAGMA foreign_keys = ON')

  // Run migrations
  runMigrations(_db)

  // Initialize prepared statements
  _queries = initQueries(_db)

  // Register shutdown handler
  onShutdown('database', () => {
    if (_db) {
      log.info('Closing database')
      _db.close()
      _db = null
    }
  }, 100) // High priority - close late

  log.info('Database initialized')

  return _db
}

/**
 * Get database instance (must be initialized first)
 */
export function getDatabase(): Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _db
}

/**
 * Close database (for testing)
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

/**
 * Create an in-memory database for testing
 */
export function createTestDatabase(): Database {
  const db = new Database(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  return db
}

/**
 * Initialize prepared statements
 */
function initQueries(db: Database): Queries {
  return {
    // Personas
    insertPersona: db.prepare(`
      INSERT INTO personas (id, session_id, name, avatar_url, status, total_xp, level, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getPersonaById: db.prepare('SELECT * FROM personas WHERE id = ?'),
    getPersonaBySessionId: db.prepare('SELECT * FROM personas WHERE session_id = ?'),
    getAllPersonas: db.prepare('SELECT * FROM personas ORDER BY last_seen_at DESC'),
    getActivePersonas: db.prepare('SELECT * FROM personas WHERE last_seen_at > ? ORDER BY last_seen_at DESC'),
    updatePersonaLastSeen: db.prepare('UPDATE personas SET last_seen_at = ? WHERE id = ?'),
    updatePersonaStatus: db.prepare('UPDATE personas SET status = ? WHERE id = ?'),
    addPersonaXp: db.prepare('UPDATE personas SET total_xp = total_xp + ? WHERE id = ?'),
    updatePersonaLevel: db.prepare('UPDATE personas SET level = ? WHERE id = ?'),
    updatePersonaBadges: db.prepare('UPDATE personas SET badges = ? WHERE id = ?'),

    // Projects
    insertProject: db.prepare(`
      INSERT INTO projects (id, path, name, github_url, project_class, total_xp, level, created_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getProjectById: db.prepare('SELECT * FROM projects WHERE id = ?'),
    getProjectByPath: db.prepare('SELECT * FROM projects WHERE path = ?'),
    getAllProjects: db.prepare('SELECT * FROM projects ORDER BY last_activity_at DESC'),
    getActiveProjects: db.prepare('SELECT * FROM projects WHERE last_activity_at > ? ORDER BY last_activity_at DESC'),
    updateProjectLastActivity: db.prepare('UPDATE projects SET last_activity_at = ? WHERE id = ?'),
    addProjectXp: db.prepare('UPDATE projects SET total_xp = total_xp + ? WHERE id = ?'),
    updateProjectLevel: db.prepare('UPDATE projects SET level = ? WHERE id = ?'),

    // XP Events
    insertXpEvent: db.prepare(`
      INSERT INTO xp_events (persona_id, project_id, event_type, xp_amount, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getXpEventsByPersona: db.prepare('SELECT * FROM xp_events WHERE persona_id = ? ORDER BY created_at DESC'),
    getXpEventsByProject: db.prepare('SELECT * FROM xp_events WHERE project_id = ? ORDER BY created_at DESC'),

    // Stats
    upsertStat: db.prepare(`
      INSERT INTO stats (entity_type, entity_id, stat_path, value)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id, stat_path) DO UPDATE SET value = value + excluded.value
    `),
    getStat: db.prepare('SELECT * FROM stats WHERE entity_type = ? AND entity_id = ? AND stat_path = ?'),
    getStatsByEntity: db.prepare('SELECT * FROM stats WHERE entity_type = ? AND entity_id = ?'),

    // Quests
    insertQuest: db.prepare(`
      INSERT INTO quests (id, project_id, title, description, status, phases, xp_awarded, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `),
    getQuestById: db.prepare('SELECT * FROM quests WHERE id = ?'),
    getQuestsByStatus: db.prepare('SELECT * FROM quests WHERE status = ? ORDER BY created_at DESC'),
    getQuestsByProject: db.prepare('SELECT * FROM quests WHERE project_id = ? ORDER BY created_at DESC'),
    updateQuestStatus: db.prepare('UPDATE quests SET status = ? WHERE id = ?'),
    updateQuestPhases: db.prepare('UPDATE quests SET phases = ? WHERE id = ?'),
    completeQuest: db.prepare('UPDATE quests SET status = "completed", completed_at = ?, xp_awarded = ? WHERE id = ?'),

    // Achievements
    insertAchievement: db.prepare(`
      INSERT OR IGNORE INTO achievements (entity_type, entity_id, achievement_id, unlocked_at)
      VALUES (?, ?, ?, ?)
    `),
    getAchievementsByEntity: db.prepare('SELECT * FROM achievements WHERE entity_type = ? AND entity_id = ? ORDER BY unlocked_at DESC'),
    achievementExists: db.prepare('SELECT COUNT(*) as count FROM achievements WHERE entity_type = ? AND entity_id = ? AND achievement_id = ?'),
    getRecentAchievements: db.prepare('SELECT * FROM achievements ORDER BY unlocked_at DESC LIMIT ?'),

    // Events
    insertEvent: db.prepare(`
      INSERT OR IGNORE INTO events (event_id, pane_id, persona_id, project_id, event_type, tool_name, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getRecentEvents: db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?'),
    deleteOldEvents: db.prepare('DELETE FROM events WHERE created_at < ?'),

    // Notes
    insertNote: db.prepare(`
      INSERT INTO notes (id, content, tags, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getNoteById: db.prepare('SELECT * FROM notes WHERE id = ?'),
    getAllNotes: db.prepare('SELECT * FROM notes ORDER BY created_at DESC'),
    getNotesByStatus: db.prepare('SELECT * FROM notes WHERE status = ? ORDER BY created_at DESC'),
    updateNote: db.prepare('UPDATE notes SET content = ?, tags = ?, status = ?, updated_at = ? WHERE id = ?'),
    deleteNote: db.prepare('DELETE FROM notes WHERE id = ?'),
  }
}

/**
 * Get prepared statements (must be initialized first)
 */
export function getQueries(): Queries {
  if (!_queries) {
    throw new Error('Queries not initialized. Call initDatabase() first.')
  }
  return _queries
}

/**
 * Exported queries object (lazy initialized)
 */
export const queries = new Proxy({} as Queries, {
  get(_target, prop) {
    return getQueries()[prop as keyof Queries]
  },
})

// Re-export query helpers
export * from './queries'
export * from './schema'
