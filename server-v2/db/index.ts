/**
 * Database initialization and connection
 */

import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { getConfig } from '../lib/config'
import { createLogger } from '../lib/logger'
import { onShutdown } from '../lib/shutdown'
import { runMigrations } from './migrations'

const log = createLogger('database')

let _db: Database | null = null

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

// Re-export query helpers
export * from './queries'
export * from './schema'
