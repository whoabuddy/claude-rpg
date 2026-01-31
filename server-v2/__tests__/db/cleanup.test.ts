/**
 * Tests for database cleanup functionality (retention policy)
 */

import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'

// Create a minimal test database with just the events table
function setupTestDb() {
  const db = new Database(':memory:')

  // Create only the events table needed for these tests
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      pane_id TEXT NOT NULL,
      persona_id TEXT,
      project_id TEXT,
      event_type TEXT NOT NULL,
      tool_name TEXT,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_pane ON events(pane_id);
  `)

  return {
    db,
    insertEvent: db.prepare(`
      INSERT OR IGNORE INTO events (event_id, pane_id, persona_id, project_id, event_type, tool_name, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getRecentEvents: db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?'),
    deleteOldEvents: db.prepare('DELETE FROM events WHERE created_at < ?'),
    countEvents: db.prepare('SELECT COUNT(*) as count FROM events'),
  }
}

describe('Event Cleanup', () => {
  test('deleteOldEvents removes events older than cutoff', () => {
    const { insertEvent, deleteOldEvents, countEvents } = setupTestDb()

    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    const sevenDays = 7 * oneDay

    // Insert events at different ages
    insertEvent.run('event-1', 'pane-1', 'persona-1', 'project-1', 'pre_tool_use', 'Edit', '{}', now - sevenDays - oneDay) // 8 days old
    insertEvent.run('event-2', 'pane-1', 'persona-1', 'project-1', 'post_tool_use', 'Edit', '{}', now - sevenDays - (oneDay / 2)) // 7.5 days old
    insertEvent.run('event-3', 'pane-1', 'persona-1', 'project-1', 'stop', null, '{}', now - sevenDays + oneDay) // 6 days old
    insertEvent.run('event-4', 'pane-1', 'persona-1', 'project-1', 'pre_tool_use', 'Bash', '{}', now - oneDay) // 1 day old
    insertEvent.run('event-5', 'pane-1', 'persona-1', 'project-1', 'stop', null, '{}', now) // just now

    // Verify all 5 events exist
    const beforeCount = countEvents.get() as { count: number }
    expect(beforeCount.count).toBe(5)

    // Delete events older than 7 days
    const cutoff = now - sevenDays
    const result = deleteOldEvents.run(cutoff)

    // Should have deleted 2 events (event-1 and event-2)
    expect(result.changes).toBe(2)

    // Verify 3 events remain
    const afterCount = countEvents.get() as { count: number }
    expect(afterCount.count).toBe(3)
  })

  test('deleteOldEvents preserves recent events', () => {
    const { insertEvent, deleteOldEvents, getRecentEvents, countEvents } = setupTestDb()

    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    // Insert only recent events (within 7 days)
    insertEvent.run('event-1', 'pane-1', 'persona-1', 'project-1', 'pre_tool_use', 'Edit', '{}', now - oneDay)
    insertEvent.run('event-2', 'pane-1', 'persona-1', 'project-1', 'post_tool_use', 'Edit', '{}', now - (oneDay * 3))
    insertEvent.run('event-3', 'pane-1', 'persona-1', 'project-1', 'stop', null, '{}', now)

    // Delete events older than 7 days
    const cutoff = now - (7 * oneDay)
    const result = deleteOldEvents.run(cutoff)

    // No events should be deleted
    expect(result.changes).toBe(0)

    // All 3 events should remain
    const afterCount = countEvents.get() as { count: number }
    expect(afterCount.count).toBe(3)
  })

  test('deleteOldEvents handles empty table', () => {
    const { deleteOldEvents, countEvents } = setupTestDb()

    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const cutoff = now - sevenDays

    // Delete from empty table
    const result = deleteOldEvents.run(cutoff)

    expect(result.changes).toBe(0)

    const count = countEvents.get() as { count: number }
    expect(count.count).toBe(0)
  })

  test('deleteOldEvents uses timestamp correctly for boundary', () => {
    const { insertEvent, deleteOldEvents, countEvents } = setupTestDb()

    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const cutoff = now - sevenDays

    // Insert event exactly at cutoff (should NOT be deleted - created_at < cutoff)
    insertEvent.run('event-at-cutoff', 'pane-1', 'persona-1', 'project-1', 'stop', null, '{}', cutoff)

    // Insert event 1ms before cutoff (should be deleted)
    insertEvent.run('event-before-cutoff', 'pane-1', 'persona-1', 'project-1', 'stop', null, '{}', cutoff - 1)

    // Insert event 1ms after cutoff (should NOT be deleted)
    insertEvent.run('event-after-cutoff', 'pane-1', 'persona-1', 'project-1', 'stop', null, '{}', cutoff + 1)

    const beforeCount = countEvents.get() as { count: number }
    expect(beforeCount.count).toBe(3)

    const result = deleteOldEvents.run(cutoff)

    // Only event-before-cutoff should be deleted
    expect(result.changes).toBe(1)

    const afterCount = countEvents.get() as { count: number }
    expect(afterCount.count).toBe(2)
  })
})

describe('Cleanup Configuration', () => {
  test('retention period is configurable', () => {
    const { insertEvent, deleteOldEvents, countEvents } = setupTestDb()

    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    // Insert events at various ages
    insertEvent.run('event-2days', 'pane-1', null, null, 'stop', null, '{}', now - (2 * oneDay))
    insertEvent.run('event-4days', 'pane-1', null, null, 'stop', null, '{}', now - (4 * oneDay))
    insertEvent.run('event-6days', 'pane-1', null, null, 'stop', null, '{}', now - (6 * oneDay))
    insertEvent.run('event-8days', 'pane-1', null, null, 'stop', null, '{}', now - (8 * oneDay))

    // Test with 3-day retention
    const threeDayCutoff = now - (3 * oneDay)
    let result = deleteOldEvents.run(threeDayCutoff)
    expect(result.changes).toBe(3) // 4, 6, 8 day events deleted

    const afterCount = countEvents.get() as { count: number }
    expect(afterCount.count).toBe(1) // Only 2-day event remains
  })
})
