/**
 * Type-safe database query helpers
 */

import { Database } from 'bun:sqlite'

/**
 * Wrap a function in a database transaction
 */
export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN TRANSACTION')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/**
 * Persona queries
 */
export interface PersonaRow {
  id: string
  name: string
  avatar_svg: string | null
  total_xp: number
  level: number
  created_at: number
  last_seen_at: number
}

export const personaQueries = {
  insert: (db: Database) => db.prepare<PersonaRow, [string, string, string | null, number]>(
    'INSERT INTO personas (id, name, avatar_svg, total_xp, level, created_at, last_seen_at) VALUES (?, ?, ?, 0, 1, ?, ?)'
  ),

  getById: (db: Database) => db.prepare<PersonaRow, [string]>(
    'SELECT * FROM personas WHERE id = ?'
  ),

  getByName: (db: Database) => db.prepare<PersonaRow, [string]>(
    'SELECT * FROM personas WHERE name = ?'
  ),

  getAll: (db: Database) => db.prepare<PersonaRow, []>(
    'SELECT * FROM personas ORDER BY last_seen_at DESC'
  ),

  updateLastSeen: (db: Database) => db.prepare<null, [number, string]>(
    'UPDATE personas SET last_seen_at = ? WHERE id = ?'
  ),

  updateXp: (db: Database) => db.prepare<null, [number, number, string]>(
    'UPDATE personas SET total_xp = ?, level = ? WHERE id = ?'
  ),

  updateAvatar: (db: Database) => db.prepare<null, [string, string]>(
    'UPDATE personas SET avatar_svg = ? WHERE id = ?'
  ),

  getAllNames: (db: Database) => db.prepare<{ name: string }, []>(
    'SELECT name FROM personas'
  ),
}

/**
 * Project queries
 */
export interface ProjectRow {
  id: string
  path: string
  name: string
  github_url: string | null
  total_xp: number
  level: number
  created_at: number
  last_activity_at: number
}

export const projectQueries = {
  insert: (db: Database) => db.prepare<ProjectRow, [string, string, string, string | null, number]>(
    'INSERT INTO projects (id, path, name, github_url, total_xp, level, created_at, last_activity_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?)'
  ),

  getById: (db: Database) => db.prepare<ProjectRow, [string]>(
    'SELECT * FROM projects WHERE id = ?'
  ),

  getByPath: (db: Database) => db.prepare<ProjectRow, [string]>(
    'SELECT * FROM projects WHERE path = ?'
  ),

  getAll: (db: Database) => db.prepare<ProjectRow, []>(
    'SELECT * FROM projects ORDER BY last_activity_at DESC'
  ),

  updateLastActivity: (db: Database) => db.prepare<null, [number, string]>(
    'UPDATE projects SET last_activity_at = ? WHERE id = ?'
  ),

  updateXp: (db: Database) => db.prepare<null, [number, number, string]>(
    'UPDATE projects SET total_xp = ?, level = ? WHERE id = ?'
  ),
}

/**
 * XP Event queries
 */
export interface XpEventRow {
  id: number
  persona_id: string | null
  project_id: string | null
  event_type: string
  xp_amount: number
  metadata: string | null
  created_at: number
}

export const xpEventQueries = {
  insert: (db: Database) => db.prepare<XpEventRow, [string | null, string | null, string, number, string | null, number]>(
    'INSERT INTO xp_events (persona_id, project_id, event_type, xp_amount, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ),

  getByPersona: (db: Database) => db.prepare<XpEventRow, [string, number]>(
    'SELECT * FROM xp_events WHERE persona_id = ? AND created_at > ? ORDER BY created_at DESC'
  ),

  getByProject: (db: Database) => db.prepare<XpEventRow, [string, number]>(
    'SELECT * FROM xp_events WHERE project_id = ? AND created_at > ? ORDER BY created_at DESC'
  ),

  sumByType: (db: Database) => db.prepare<{ event_type: string; total: number }, [string, string, number]>(
    'SELECT event_type, SUM(xp_amount) as total FROM xp_events WHERE ? = ? AND created_at > ? GROUP BY event_type'
  ),
}

/**
 * Stats queries
 */
export interface StatRow {
  id: number
  entity_type: string
  entity_id: string
  stat_path: string
  value: number
}

export const statQueries = {
  upsert: (db: Database) => db.prepare<StatRow, [string, string, string, number]>(
    `INSERT INTO stats (entity_type, entity_id, stat_path, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(entity_type, entity_id, stat_path) DO UPDATE SET value = value + excluded.value`
  ),

  get: (db: Database) => db.prepare<StatRow, [string, string, string]>(
    'SELECT * FROM stats WHERE entity_type = ? AND entity_id = ? AND stat_path = ?'
  ),

  getAll: (db: Database) => db.prepare<StatRow, [string, string]>(
    'SELECT * FROM stats WHERE entity_type = ? AND entity_id = ?'
  ),
}

/**
 * Quest queries
 */
export interface QuestRow {
  id: string
  project_id: string | null
  title: string
  description: string | null
  status: string
  phases: string
  xp_awarded: number
  created_at: number
  started_at: number | null
  completed_at: number | null
}

export const questQueries = {
  insert: (db: Database) => db.prepare<QuestRow, [string, string | null, string, string | null, string, string, number]>(
    'INSERT INTO quests (id, project_id, title, description, status, phases, xp_awarded, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ),

  getById: (db: Database) => db.prepare<QuestRow, [string]>(
    'SELECT * FROM quests WHERE id = ?'
  ),

  getByStatus: (db: Database) => db.prepare<QuestRow, [string]>(
    'SELECT * FROM quests WHERE status = ? ORDER BY created_at DESC'
  ),

  getByProject: (db: Database) => db.prepare<QuestRow, [string]>(
    'SELECT * FROM quests WHERE project_id = ? ORDER BY created_at DESC'
  ),

  updateStatus: (db: Database) => db.prepare<null, [string, string]>(
    'UPDATE quests SET status = ? WHERE id = ?'
  ),

  updatePhases: (db: Database) => db.prepare<null, [string, string]>(
    'UPDATE quests SET phases = ? WHERE id = ?'
  ),

  complete: (db: Database) => db.prepare<null, [number, number, string]>(
    'UPDATE quests SET status = "completed", completed_at = ?, xp_awarded = ? WHERE id = ?'
  ),
}

/**
 * Achievement queries
 */
export interface AchievementRow {
  id: number
  entity_type: string
  entity_id: string
  achievement_id: string
  unlocked_at: number
}

export const achievementQueries = {
  insert: (db: Database) => db.prepare<AchievementRow, [string, string, string, number]>(
    'INSERT OR IGNORE INTO achievements (entity_type, entity_id, achievement_id, unlocked_at) VALUES (?, ?, ?, ?)'
  ),

  getByEntity: (db: Database) => db.prepare<AchievementRow, [string, string]>(
    'SELECT * FROM achievements WHERE entity_type = ? AND entity_id = ? ORDER BY unlocked_at DESC'
  ),

  exists: (db: Database) => db.prepare<{ count: number }, [string, string, string]>(
    'SELECT COUNT(*) as count FROM achievements WHERE entity_type = ? AND entity_id = ? AND achievement_id = ?'
  ),

  getRecent: (db: Database) => db.prepare<AchievementRow, [number]>(
    'SELECT * FROM achievements ORDER BY unlocked_at DESC LIMIT ?'
  ),
}

/**
 * Event queries (Claude hook events)
 */
export interface EventRow {
  id: number
  event_id: string | null
  pane_id: string
  persona_id: string | null
  project_id: string | null
  event_type: string
  tool_name: string | null
  payload: string | null
  created_at: number
}

export const eventQueries = {
  insert: (db: Database) => db.prepare<EventRow, [string | null, string, string | null, string | null, string, string | null, string | null, number]>(
    'INSERT OR IGNORE INTO events (event_id, pane_id, persona_id, project_id, event_type, tool_name, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),

  getRecent: (db: Database) => db.prepare<EventRow, [number]>(
    'SELECT * FROM events ORDER BY created_at DESC LIMIT ?'
  ),

  deleteOld: (db: Database) => db.prepare<null, [number]>(
    'DELETE FROM events WHERE created_at < ?'
  ),
}
