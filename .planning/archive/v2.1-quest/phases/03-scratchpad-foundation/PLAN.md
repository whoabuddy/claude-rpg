# Phase 3: Add Scratchpad Foundation

## Goal

Basic scratchpad storage and simple UI for quick text capture and review.

## Context

**Existing Infrastructure:**
- `server-v2/db/schema.ts` defines tables with CREATE_TABLES string
- `server-v2/db/migrations.ts` runs schema on startup
- `server-v2/db/index.ts` has Queries interface and initQueries() for prepared statements
- Uses `bun:sqlite` with WAL mode
- Routes/handlers follow established patterns from phases 1-2

**Database Pattern:**
1. Add table definition to CREATE_TABLES in schema.ts
2. Add row interface and queries to queries.ts
3. Add prepared statements to Queries interface and initQueries() in index.ts
4. Create service module for business logic

**Note Schema:**
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  tags TEXT,  -- JSON array of strings
  status TEXT NOT NULL DEFAULT 'inbox',  -- inbox, triaged, archived
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

<plan>
  <goal>Add notes table to database and CRUD endpoints for scratchpad</goal>
  <context>Follow existing db patterns, add notes table + service + API endpoints + simple UI</context>

  <task id="1">
    <name>Add notes table and database layer</name>
    <files>server-v2/db/schema.ts, server-v2/db/index.ts</files>
    <action>
1. Add notes table to CREATE_TABLES in server-v2/db/schema.ts:
   ```sql
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
   ```

2. Add 'notes' to TABLES array in schema.ts

3. Add to Queries interface in server-v2/db/index.ts:
   - insertNote
   - getNoteById
   - getAllNotes
   - getNotesByStatus
   - updateNote
   - deleteNote

4. Add prepared statements to initQueries() in index.ts
    </action>
    <verify>Server starts without database errors</verify>
    <done>Notes table is created on startup and queries are available</done>
  </task>

  <task id="2">
    <name>Add notes service and API endpoints</name>
    <files>server-v2/notes/service.ts, server-v2/notes/index.ts, server-v2/api/routes.ts, server-v2/api/handlers.ts, server-v2/api/types.ts</files>
    <action>
1. Create server-v2/notes/service.ts:
   - createNote(content: string, tags?: string[]): Note
   - getNoteById(id: string): Note | null
   - getAllNotes(status?: NoteStatus): Note[]
   - updateNote(id: string, updates: Partial<Note>): Note
   - deleteNote(id: string): boolean
   - Note interface: { id, content, tags, status, createdAt, updatedAt }

2. Create server-v2/notes/index.ts to export service

3. Add types to server-v2/api/types.ts:
   - CreateNoteRequest { content: string, tags?: string[] }
   - UpdateNoteRequest { content?: string, tags?: string[], status?: string }

4. Add routes to server-v2/api/routes.ts:
   - GET /api/notes -> listNotes
   - POST /api/notes -> createNote
   - GET /api/notes/:id -> getNote
   - PATCH /api/notes/:id -> updateNote
   - DELETE /api/notes/:id -> deleteNote

5. Add handlers to server-v2/api/handlers.ts
    </action>
    <verify>curl http://localhost:4011/api/notes returns { success: true, data: { notes: [] } }</verify>
    <done>CRUD endpoints work for notes</done>
  </task>

  <task id="3">
    <name>Create ScratchpadPage with basic UI</name>
    <files>src/routes/ScratchpadPage.tsx, src/App.tsx</files>
    <action>
1. Create src/routes/ScratchpadPage.tsx:
   - State: notes[], newNote content, isLoading
   - Fetch notes on mount from /api/notes
   - Text input area for new note content
   - Submit button to POST new note
   - List of existing notes with:
     - Content preview (truncated)
     - Created date
     - Delete button
   - Simple status tabs: All, Inbox, Archived

2. Styling (match existing RPG theme):
   - Dark background, card layout
   - Textarea with placeholder "Quick thought..."
   - Note cards with content, timestamp

3. Add route to src/App.tsx:
   - Import ScratchpadPage
   - Add <Route path="scratchpad" element={<ScratchpadPage />} />
    </action>
    <verify>Navigate to /scratchpad, create note, see it in list</verify>
    <done>ScratchpadPage displays notes and allows creating new ones</done>
  </task>
</plan>

## Issue

Addresses #156 (partial - foundation only, voice + triage in phase 6)

## Commit Format

```
feat(scratchpad): add notes storage and basic UI

- Add notes table to database schema
- Add CRUD endpoints for notes
- Create ScratchpadPage with text input and note list

Addresses #156
```
