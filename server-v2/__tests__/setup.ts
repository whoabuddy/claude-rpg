/**
 * Test setup and utilities
 */

import { Database } from 'bun:sqlite'
import { runMigrations } from '../db/migrations'

let testDb: Database | null = null

/**
 * Create an in-memory test database
 */
export function createTestDb(): Database {
  const db = new Database(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  testDb = db
  return db
}

/**
 * Get the current test database
 */
export function getTestDb(): Database {
  if (!testDb) {
    throw new Error('Test database not initialized. Call createTestDb() first.')
  }
  return testDb
}

/**
 * Clean up test database
 */
export function cleanupTestDb(): void {
  if (testDb) {
    testDb.close()
    testDb = null
  }
}

/**
 * Reset test database (clear all data)
 */
export function resetTestDb(): void {
  if (testDb) {
    testDb.exec('DELETE FROM events')
    testDb.exec('DELETE FROM achievements')
    testDb.exec('DELETE FROM xp_events')
    testDb.exec('DELETE FROM stats')
    testDb.exec('DELETE FROM quests')
    testDb.exec('DELETE FROM projects')
    testDb.exec('DELETE FROM personas')
  }
}
