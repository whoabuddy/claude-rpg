# Phase 1: Add Audio File Transcription Page

## Goal

Allow users to upload an audio file and receive transcribed text, exposed as a standalone page with drag-drop upload UI.

## Context

**Existing Infrastructure:**
- `server/whisper.ts` has working transcription logic using whisper.cpp CLI
- `src/hooks/useVoiceInput.ts` already POSTs to `/api/transcribe` endpoint
- `shared/defaults.ts` defines `WHISPER_MODEL` path and `WHISPER_TIMEOUT_MS`
- Server-v2 uses modular handler pattern in `server-v2/api/handlers.ts`
- Routes defined in `server-v2/api/routes.ts` with pattern matching
- API index handles body parsing for POST requests but only JSON

**Key Patterns:**
- Handlers return `ApiResponse<T>` with `{ success, data/error }`
- Routes use `{ method, pattern, handler }` format
- Client pages live in `src/routes/` and are imported in `App.tsx`

**Challenge:**
- Current API only parses JSON body, need to handle binary WAV data
- useVoiceInput sends `Content-Type: audio/wav` with ArrayBuffer body

<plan>
  <goal>Add /api/transcribe endpoint to server-v2 and create TranscribePage with file upload UI</goal>
  <context>Port whisper.ts to server-v2/lib/, add binary body handling to API, create standalone page</context>

  <task id="1">
    <name>Add whisper transcription module to server-v2</name>
    <files>server-v2/lib/whisper.ts, shared/defaults.ts</files>
    <action>
1. Create server-v2/lib/whisper.ts with:
   - isWhisperAvailable() - check if whisper model exists
   - transcribeAudio(audioBuffer: Buffer) - write temp file, run whisper CLI, return text
   - Use Bun.spawn or Bun.spawnSync for subprocess (not Node's execFile)
   - Import WHISPER_MODEL and WHISPER_TIMEOUT_MS from shared/defaults

2. Port the logic from server/whisper.ts but adapt for Bun:
   - Use Bun.write for temp file
   - Use Bun.spawn with timeout for whisper CLI
   - Clean up temp file after transcription
    </action>
    <verify>bun run server-v2/lib/whisper.ts (should export without errors)</verify>
    <done>whisper.ts exports isWhisperAvailable and transcribeAudio functions</done>
  </task>

  <task id="2">
    <name>Add /api/transcribe endpoint with binary body handling</name>
    <files>server-v2/api/routes.ts, server-v2/api/handlers.ts, server-v2/api/index.ts, server-v2/api/types.ts</files>
    <action>
1. Add route to server-v2/api/routes.ts:
   { method: 'POST', pattern: '/api/transcribe', handler: 'transcribeAudio' }

2. Add handler to server-v2/api/handlers.ts:
   - Import { isWhisperAvailable, transcribeAudio } from '../lib/whisper'
   - export async function transcribeAudio(audioData: Buffer): Promise<ApiResponse<{ text: string }>>
   - Check isWhisperAvailable, return error if not
   - Call transcribeAudio, return { ok: true, text } or error

3. Update server-v2/api/index.ts handleRequest():
   - Before JSON parsing, check Content-Type header
   - If 'audio/wav', read body as ArrayBuffer and convert to Buffer
   - Pass Buffer to handler instead of parsed JSON

4. Add TranscribeResponse type to server-v2/api/types.ts
    </action>
    <verify>curl -X POST http://localhost:4011/api/transcribe -H "Content-Type: audio/wav" --data-binary @test.wav</verify>
    <done>POST /api/transcribe accepts audio/wav and returns { ok, text } or { ok: false, error }</done>
  </task>

  <task id="3">
    <name>Create TranscribePage with file upload UI</name>
    <files>src/routes/TranscribePage.tsx, src/App.tsx</files>
    <action>
1. Create src/routes/TranscribePage.tsx:
   - State: file, isProcessing, result, error
   - Drag-drop zone component with file input fallback
   - Accept audio/* files (wav, mp3, m4a, webm, ogg)
   - On file drop/select: convert to WAV if needed using AudioContext
   - POST to /api/transcribe with audio/wav content-type
   - Display result in textarea (copyable)
   - Show error state with retry option

2. Styling:
   - Full-width centered layout
   - Large drop zone with dashed border
   - Processing spinner overlay
   - Success/error states with appropriate colors

3. Add route to src/App.tsx:
   - Import TranscribePage
   - Add <Route path="transcribe" element={<TranscribePage />} />
    </action>
    <verify>npm run dev, navigate to /transcribe, upload audio file</verify>
    <done>TranscribePage renders, accepts file upload, shows transcription result</done>
  </task>
</plan>

## Issue

Closes #153

## Commit Format

```
feat(transcribe): add audio file transcription page

- Add whisper.ts module to server-v2 for transcription
- Add POST /api/transcribe endpoint with binary body support
- Create TranscribePage with drag-drop file upload UI

Closes #153
```
