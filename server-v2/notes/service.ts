/**
 * Notes service for scratchpad functionality
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import type { Note, NoteStatus } from '../../shared/types'

const log = createLogger('notes')

// Re-export types for convenience
export type { Note, NoteStatus }

interface NoteRow {
  id: string
  content: string
  tags: string | null
  status: string
  created_at: string
  updated_at: string
}

/**
 * Convert database row to Note interface
 */
function mapDbToNote(row: NoteRow): Note {
  return {
    id: row.id,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    status: row.status as NoteStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Create a new note
 */
export function createNote(content: string, tags: string[] = []): Note {
  const now = new Date().toISOString()
  const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  queries.insertNote.run(
    id,
    content,
    tags.length > 0 ? JSON.stringify(tags) : null,
    'inbox',
    now,
    now
  )

  log.info('Created note', { id, tagsCount: tags.length })

  return {
    id,
    content,
    tags,
    status: 'inbox',
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Get a note by ID
 */
export function getNoteById(id: string): Note | null {
  const row = queries.getNoteById.get(id) as NoteRow | null

  if (!row) {
    return null
  }

  return mapDbToNote(row)
}

/**
 * Get all notes, optionally filtered by status
 */
export function getAllNotes(status?: NoteStatus): Note[] {
  let rows: NoteRow[]

  if (status) {
    rows = queries.getNotesByStatus.all(status) as NoteRow[]
  } else {
    rows = queries.getAllNotes.all() as NoteRow[]
  }

  return rows.map(mapDbToNote)
}

/**
 * Update a note
 */
export function updateNote(
  id: string,
  updates: { content?: string; tags?: string[]; status?: NoteStatus }
): Note | null {
  // First, get the current note
  const current = getNoteById(id)
  if (!current) {
    return null
  }

  const now = new Date().toISOString()
  const content = updates.content !== undefined ? updates.content : current.content
  const tags = updates.tags !== undefined ? updates.tags : current.tags
  const status = updates.status !== undefined ? updates.status : current.status

  queries.updateNote.run(
    content,
    tags.length > 0 ? JSON.stringify(tags) : null,
    status,
    now,
    id
  )

  log.info('Updated note', { id, updates: Object.keys(updates) })

  return {
    id,
    content,
    tags,
    status,
    createdAt: current.createdAt,
    updatedAt: now,
  }
}

/**
 * Delete a note
 */
export function deleteNote(id: string): boolean {
  const result = queries.deleteNote.run(id)

  const deleted = result.changes > 0
  if (deleted) {
    log.info('Deleted note', { id })
  }

  return deleted
}
