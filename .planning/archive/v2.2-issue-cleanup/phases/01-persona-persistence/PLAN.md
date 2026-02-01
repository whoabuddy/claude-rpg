# PLAN: Phase 1 - Fix Persona Persistence Bug

<plan>
  <goal>
    Fix persona ID stability across server restarts by deferring persona creation until the first hook event arrives (which contains the stable Claude sessionId).
  </goal>

  <context>
    Current flow (broken):
    1. Tmux poller detects Claude process in pane
    2. Server immediately creates persona with random UUID
    3. On restart, new UUIDs generated -> frontend has stale IDs -> 404s

    New flow (fixed):
    1. Tmux poller detects Claude process in pane
    2. Server marks pane as "awaiting-identity" (no persona yet)
    3. First hook event arrives with stable sessionId
    4. Server creates persona keyed by sessionId (or finds existing)
    5. Persona persists across restarts because sessionId is deterministic

    Key insight: Claude's sessionId is stable within a session and is provided in every hook event. Use this as the correlation key, not the randomly-generated persona.id.

    Files to read first:
    - server-v2/personas/service.ts (getOrCreatePersona logic)
    - server-v2/events/handlers.ts (how hook events trigger persona creation)
    - server-v2/sessions/manager.ts (session -> persona correlation)
    - server-v2/tmux/poller.ts (where Claude detection happens)
  </context>

  <task id="1">
    <name>Add sessionId-based persona lookup</name>
    <files>server-v2/personas/service.ts, server-v2/db/schema.ts, server-v2/db/queries.ts</files>
    <action>
      1. In db/schema.ts, verify personas table has session_id column (it does)
      2. In db/queries.ts, verify getPersonaBySessionId query exists
      3. In personas/service.ts, modify getOrCreatePersona:
         - Remove eager avatar fetching (move to background)
         - Ensure persona is keyed by sessionId not random UUID
         - Add logging to trace persona creation
      4. Add function `findPersonaBySessionId(sessionId: string): Persona | null`
         that does NOT create if not found
    </action>
    <verify>
      Run: bun test server-v2/__tests__/
      Expected: All existing tests pass

      Manual check: Read the modified getOrCreatePersona function and verify
      it only creates when sessionId is provided and no existing persona found.
    </verify>
    <done>Persona lookup uses sessionId as primary key; getOrCreatePersona is idempotent</done>
  </task>

  <task id="2">
    <name>Defer persona creation to first hook event</name>
    <files>server-v2/events/handlers.ts, server-v2/sessions/manager.ts, server-v2/tmux/poller.ts</files>
    <action>
      1. In sessions/manager.ts, modify getOrCreateSession:
         - Accept sessionId as optional parameter
         - If sessionId provided, link to persona immediately
         - If no sessionId, leave personaId null (awaiting identity)

      2. In events/handlers.ts, update hook event handlers:
         - On first hook event (any type), call getOrCreatePersona with sessionId
         - Link persona to session: session.personaId = persona.id
         - Ensure all subsequent events find the existing persona

      3. In tmux/poller.ts (or wherever Claude detection happens):
         - Remove any eager persona creation
         - Just create the session with personaId=null
         - Persona will be assigned when first hook arrives

      Reference pattern from events/handlers.ts line 57-58:
      ```typescript
      const persona = await getOrCreatePersona(event.sessionId)
      ```
      This is correct - just ensure it's the ONLY place personas are created.
    </action>
    <verify>
      1. Stop server, delete ~/.aibtc/claude-rpg.db (or clear personas table)
      2. Start server: bun run server-v2/index.ts
      3. Open Claude in a tmux pane
      4. Before typing anything, check: GET /api/personas should return []
      5. Type a prompt in Claude (triggers user_prompt_submit hook)
      6. Check: GET /api/personas should return 1 persona
      7. Restart server
      8. Check: GET /api/personas should return same persona with same ID
      9. Check: GET /api/personas/:id/challenges should NOT 404
    </verify>
    <done>Personas only created on first hook event; IDs stable across restarts</done>
  </task>

  <task id="3">
    <name>Update WebSocket to handle pending-identity panes</name>
    <files>server-v2/api/ws.ts, server-v2/api/broadcast.ts, shared/types.ts</files>
    <action>
      1. In shared/types.ts, verify ClaudeSessionInfo can have null/undefined name
         (for panes awaiting identity)

      2. In api/ws.ts and api/broadcast.ts:
         - When sending pane data, handle panes with no persona yet
         - Send placeholder name like "Claude (initializing...)" or similar
         - Once persona assigned, send full info

      3. Consider adding a "awaitingIdentity" boolean to ClaudeSessionInfo
         so frontend can show appropriate UI

      4. Update frontend PaneCard to show "Initializing..." for panes
         without a persona yet (graceful degradation)
    </action>
    <verify>
      1. Start fresh (delete DB)
      2. Start server, open frontend
      3. Open Claude in tmux pane
      4. Observe: PaneCard should show "Initializing..." or similar
      5. Type a prompt
      6. Observe: PaneCard should now show assigned name
      7. Verify no console errors in browser
    </verify>
    <done>Frontend gracefully handles panes awaiting persona assignment</done>
  </task>
</plan>

## Files Summary

**Read first:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/personas/service.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/tmux/poller.ts`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/personas/service.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/ws.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/shared/types.ts`

**Frontend (minor):**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`

## Commits

1. `fix(personas): add sessionId-based lookup for stable IDs`
2. `fix(personas): defer creation to first hook event`
3. `fix(ui): handle panes awaiting persona assignment`
