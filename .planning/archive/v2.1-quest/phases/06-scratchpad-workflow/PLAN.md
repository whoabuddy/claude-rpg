# Phase 6: Complete Scratchpad Workflow

<plan>
  <goal>Add voice input, triage workflow, and optional GitHub issue integration to the scratchpad feature.</goal>

  <context>
    **Existing Foundation (Phase 3):**
    - Database schema already has `notes` table with: id, content, tags, status (inbox/triaged/archived), created_at, updated_at
    - CRUD endpoints exist: GET/POST `/api/notes`, PATCH/DELETE `/api/notes/:id`
    - ScratchpadPage.tsx has: note list, text input form, filter tabs (all/inbox/archived), delete action

    **Voice Infrastructure (Phase 1):**
    - `VoiceButton` component exists at `src/components/VoiceButton.tsx` - push-to-talk with visual feedback
    - `useVoiceInput` hook handles MediaRecorder, WAV encoding, and POST to `/api/transcribe`
    - `/api/transcribe` endpoint uses whisper.cpp for transcription
    - VoiceButton accepts `onTranscription(text: string)` callback

    **Current Status Values:**
    - Schema supports: 'inbox' | 'triaged' | 'archived'
    - PHASES.md mentions 'converted' status for notes converted to GitHub issues (not yet implemented)

    **Key Patterns:**
    - Notes service in `server-v2/notes/service.ts` exports createNote, getNoteById, getAllNotes, updateNote, deleteNote
    - API handlers in `server-v2/api/handlers.ts` handle validation and call service functions
    - Frontend uses fetch to call API endpoints directly

    **GitHub CLI:**
    - `gh issue create` can be invoked server-side via Bun.spawn
    - Need repo detection from note content or user selection
  </context>

  <task id="1">
    <name>Add voice input to scratchpad</name>
    <files>src/routes/ScratchpadPage.tsx, src/components/VoiceButton.tsx</files>
    <action>
      1. Import VoiceButton component in ScratchpadPage.tsx
      2. Add VoiceButton next to the "Add Note" button in the form
      3. Wire onTranscription callback to append text to newNoteContent state
      4. Handle voice input during existing note creation flow (don't auto-submit, let user review)

      Implementation details:
      - Place VoiceButton to the left of the "Add Note" button
      - When transcription completes, append to textarea with newline if content exists
      - Use the existing isCreating state to disable VoiceButton during note creation
      - Match existing button styling (similar size and padding to Add Note button)
    </action>
    <verify>
      1. Start the dev server: `cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun run dev`
      2. Navigate to /scratchpad in browser
      3. Verify VoiceButton renders next to Add Note button
      4. Hold VoiceButton, speak, release - text should appear in textarea
      5. Can add more text manually, then click Add Note to save
      6. Run tests: `bun test src/__tests__/ScratchpadPage.test.tsx` (if exists)
    </verify>
    <done>Voice recording button appears on scratchpad page, transcribed text appends to note input</done>
  </task>

  <task id="2">
    <name>Add triage actions to notes</name>
    <files>
      src/routes/ScratchpadPage.tsx,
      src/components/NoteCard.tsx (new),
      server-v2/notes/service.ts,
      server-v2/api/handlers.ts
    </files>
    <action>
      1. Add 'converted' to NoteStatus type in server-v2/notes/service.ts:
         `export type NoteStatus = 'inbox' | 'triaged' | 'archived' | 'converted'`

      2. Update handlers.ts validation to accept 'converted' status

      3. Create NoteCard.tsx component extracted from ScratchpadPage inline rendering:
         - Props: note: Note, onStatusChange: (id, status) => void, onDelete: (id) => void
         - Display: content, timestamp, tags, status badge
         - Actions row with buttons based on current status:
           - inbox: "Archive", "Mark Triaged", "Create Issue"
           - triaged: "Archive", "Create Issue"
           - archived: "Restore to Inbox"
           - converted: read-only with "Converted to Issue" badge
         - Each action calls PATCH /api/notes/:id with new status

      4. Update ScratchpadPage.tsx:
         - Import and use NoteCard instead of inline note rendering
         - Add handleStatusChange function that calls PATCH endpoint
         - Add 'triaged' and 'converted' to filter options
         - Add count badges to filter tabs showing notes per status

      5. Add "Create Issue" action (placeholder that sets status to 'converted' for now):
         - In NoteCard, "Create Issue" button calls a callback
         - In ScratchpadPage, showIssueModal state triggers modal (Task 3 completes this)
         - For now, just show alert("GitHub issue creation coming soon") and set status to converted
    </action>
    <verify>
      1. Verify new status validation works:
         `curl -X PATCH http://localhost:4011/api/notes/NOTE_ID -H "Content-Type: application/json" -d '{"status":"converted"}'`
      2. Start dev server and navigate to /scratchpad
      3. Create a note, verify it shows in Inbox tab
      4. Click "Archive" - note moves to Archived tab
      5. From Archived, click "Restore to Inbox" - note returns to Inbox
      6. Click "Mark Triaged" - note moves to Triaged tab
      7. Filter tabs show correct counts
      8. "Create Issue" shows placeholder alert
    </verify>
    <done>Notes can be triaged between inbox/triaged/archived/converted states, UI shows status-appropriate actions</done>
  </task>

  <task id="3">
    <name>Add GitHub issue creation</name>
    <files>
      server-v2/notes/github.ts (new),
      server-v2/api/handlers.ts,
      server-v2/api/routes.ts,
      server-v2/api/types.ts,
      src/routes/ScratchpadPage.tsx,
      src/components/CreateIssueModal.tsx (new)
    </files>
    <action>
      1. Create server-v2/notes/github.ts:
         - Function: createGitHubIssue(options: { title: string, body: string, repo: string, labels?: string[] })
         - Use Bun.spawn to run: `gh issue create --repo REPO --title TITLE --body BODY [--label LABEL]`
         - Parse output to get issue URL
         - Return { success: boolean, issueUrl?: string, error?: string }

      2. Add API endpoint in routes.ts:
         `{ method: 'POST', pattern: '/api/notes/:id/create-issue', handler: 'createIssueFromNote' }`

      3. Add handler in handlers.ts:
         - createIssueFromNote(params, body: { repo: string, title?: string, labels?: string[] })
         - Get note by ID
         - Call createGitHubIssue with note content as body
         - Update note status to 'converted' and add metadata (issueUrl) to tags
         - Return success with issueUrl

      4. Add types in types.ts:
         ```typescript
         export interface CreateIssueRequest {
           repo: string
           title?: string
           labels?: string[]
         }
         ```

      5. Create CreateIssueModal.tsx:
         - Props: note: Note | null, onClose: () => void, onCreated: (noteId: string, issueUrl: string) => void
         - Form fields: repo (text input), title (defaults to first line of content), labels (optional)
         - Suggest repos from recent projects if available
         - Submit calls POST /api/notes/:id/create-issue
         - On success, show link to issue and close modal

      6. Update ScratchpadPage.tsx:
         - Add selectedNoteForIssue state and CreateIssueModal
         - "Create Issue" button sets selectedNoteForIssue instead of showing alert
         - onCreated callback refreshes notes list
    </action>
    <verify>
      1. Ensure gh CLI is authenticated: `gh auth status`
      2. Create a test note via /scratchpad
      3. Click "Create Issue" on the note
      4. Modal appears with repo input and title field
      5. Enter a test repo (e.g., whoabuddy/claude-rpg), submit
      6. Verify issue is created: `gh issue list --repo whoabuddy/claude-rpg --limit 1`
      7. Note status changes to "converted" with issue URL in metadata
      8. Modal shows link to created issue
      9. Test error handling: enter invalid repo, verify error message appears
    </verify>
    <done>Users can convert notes to GitHub issues via modal, issue URL is stored, note marked as converted</done>
  </task>
</plan>

## Execution Notes

- Task 1 is independent and can be done quickly by reusing existing VoiceButton
- Task 2 establishes the triage workflow foundation
- Task 3 adds the GitHub integration on top of the triage workflow

## Risk Mitigation

- **Whisper availability**: VoiceButton already handles whisper unavailable gracefully (shows error)
- **GitHub auth**: Check `gh auth status` before attempting issue creation, show helpful error if not authenticated
- **Repo validation**: Validate repo format client-side before API call
