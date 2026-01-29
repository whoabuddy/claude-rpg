/**
 * Database migration runner
 */

import { Database } from 'bun:sqlite'
import { createLogger } from '../lib/logger'
import { SCHEMA_VERSION, CREATE_TABLES } from './schema'

const log = createLogger('migrations')

interface Migration {
  version: number
  name: string
  sql: string
}

/**
 * All migrations in order
 * Each migration should be idempotent (CREATE IF NOT EXISTS, etc.)
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: CREATE_TABLES,
  },
  {
    version: 2,
    name: 'add_notes_table',
    sql: `
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        tags TEXT,
        status TEXT NOT NULL DEFAULT 'inbox',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
      CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);
    `,
  },
]

/**
 * Get current schema version from database
 */
function getCurrentVersion(db: Database): number {
  try {
    const row = db.query('SELECT MAX(version) as version FROM schema_version').get() as { version: number | null }
    return row?.version ?? 0
  } catch {
    // Table doesn't exist yet
    return 0
  }
}

/**
 * Record a migration as applied
 */
function recordMigration(db: Database, version: number): void {
  db.run(
    'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
    [version, new Date().toISOString()]
  )
}

/**
 * Run pending migrations
 */
export function runMigrations(db: Database): void {
  const currentVersion = getCurrentVersion(db)
  const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion)

  if (pendingMigrations.length === 0) {
    log.debug('No pending migrations', { currentVersion })
    return
  }

  log.info('Running migrations', {
    currentVersion,
    targetVersion: SCHEMA_VERSION,
    pending: pendingMigrations.length,
  })

  for (const migration of pendingMigrations) {
    log.info('Applying migration', { version: migration.version, name: migration.name })

    try {
      // Run migration in a transaction
      db.exec('BEGIN TRANSACTION')

      // Execute migration SQL (may contain multiple statements)
      db.exec(migration.sql)

      // Record migration
      recordMigration(db, migration.version)

      db.exec('COMMIT')

      log.info('Migration applied', { version: migration.version, name: migration.name })
    } catch (error) {
      db.exec('ROLLBACK')
      log.error('Migration failed', {
        version: migration.version,
        name: migration.name,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  log.info('Migrations complete', { version: getCurrentVersion(db) })
}

/**
 * Check if database is up to date
 */
export function isDatabaseUpToDate(db: Database): boolean {
  return getCurrentVersion(db) >= SCHEMA_VERSION
}
