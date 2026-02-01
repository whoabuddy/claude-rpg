# PLAN: Phase 3 - Fix Quests Data Flow

<plan>
  <goal>
    Fix quests loading so the Quests page displays data correctly and integrates with the /quest-create skill workflow.
  </goal>

  <context>
    Current state:
    - Quest service exists (server-v2/quests/service.ts) with create/get functions
    - API routes exist (/api/quests GET, POST, PATCH)
    - WebSocket has quest_update and quests_init message types
    - Frontend has useQuests hook and QuestsPage component
    - But quests aren't showing up

    Potential issues:
    1. WebSocket may not be sending quests_init on connect
    2. API handler may not be wired up correctly
    3. Store may not be receiving/storing quest data
    4. Quest creation may not be triggering broadcasts

    The /quest-create skill creates quests via API - need to verify that flow.

    Files to read:
    - server-v2/quests/service.ts (quest CRUD)
    - server-v2/api/handlers.ts (API handlers)
    - server-v2/api/ws.ts (WebSocket initialization)
    - src/hooks/useQuests.ts (frontend hook)
    - src/store/index.ts (quest slice)
  </context>

  <task id="1">
    <name>Verify and fix API handlers</name>
    <files>server-v2/api/handlers.ts, server-v2/api/routes.ts</files>
    <action>
      1. In handlers.ts, find listQuests handler and verify it:
         - Calls getActiveQuests() from quest service
         - Returns proper JSON response
         - Handles errors gracefully

      2. If handler is missing or broken, implement:
         ```typescript
         export async function listQuests(req: Request): Promise<Response> {
           try {
             const quests = getActiveQuests()
             return Response.json({ success: true, data: quests })
           } catch (error) {
             return Response.json({ success: false, error: String(error) }, { status: 500 })
           }
         }
         ```

      3. Verify route is wired in routes.ts:
         ```typescript
         { method: 'GET', pattern: '/api/quests', handler: 'listQuests' },
         ```

      4. Test manually: curl http://localhost:4011/api/quests
    </action>
    <verify>
      1. Start server
      2. Run: curl -s http://localhost:4011/api/quests | jq
      3. Should return: { "success": true, "data": [...] }
      4. If no quests exist, data should be empty array []
    </verify>
    <done>GET /api/quests returns quest data correctly</done>
  </task>

  <task id="2">
    <name>Fix WebSocket quests initialization</name>
    <files>server-v2/api/ws.ts, server-v2/api/broadcast.ts</files>
    <action>
      1. In ws.ts, find the connection handler (on 'open' or 'connection')
      2. Ensure it sends quests_init after sending companions:
         ```typescript
         // After companions_init
         const quests = getActiveQuests()
         send({ type: 'quests_init', payload: quests })
         ```

      3. Verify broadcast.ts has a broadcastQuestUpdate function:
         ```typescript
         export function broadcastQuestUpdate(quest: Quest): void {
           broadcast({ type: 'quest_update', payload: quest })
         }
         ```

      4. In quest service, call broadcastQuestUpdate after:
         - createQuest
         - updateQuestStatus
         - updatePhaseStatus
         - completeQuest
    </action>
    <verify>
      1. Open browser dev tools, Network tab, filter WS
      2. Connect to app
      3. Look for 'quests_init' message in WebSocket stream
      4. Create a quest via API: curl -X POST http://localhost:4011/api/quests ...
      5. Verify 'quest_update' message appears in WebSocket
    </verify>
    <done>WebSocket sends quests on connect and broadcasts updates</done>
  </task>

  <task id="3">
    <name>Fix frontend quest store and hook</name>
    <files>src/store/index.ts, src/hooks/useQuests.ts, src/lib/websocket.ts</files>
    <action>
      1. In store/index.ts, verify quests slice exists:
         ```typescript
         quests: Quest[]
         setQuests: (quests: Quest[]) => void
         updateQuest: (quest: Quest) => void
         ```

      2. In websocket.ts, handle quest messages:
         ```typescript
         case 'quests_init':
           store.setQuests(message.payload)
           break
         case 'quest_update':
           store.updateQuest(message.payload)
           break
         ```

      3. In useQuests.ts, use store selectors:
         ```typescript
         export function useQuests() {
           const quests = useStore(state => state.quests)
           const activeQuests = useMemo(
             () => quests.filter(q => q.status === 'active' || q.status === 'planned'),
             [quests]
           )
           return { quests, activeQuests, loading: false }
         }
         ```

      4. Remove any duplicate/conflicting state management
    </action>
    <verify>
      1. Open Quests page in browser
      2. Check React DevTools for quest state
      3. Create a quest via API
      4. Verify quest appears in UI without refresh
      5. Check console for any errors
    </verify>
    <done>Frontend correctly receives and displays quests</done>
  </task>
</plan>

## Files Summary

**Read first:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/quests/service.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/ws.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/hooks/useQuests.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/store/index.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/lib/websocket.ts`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/ws.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/broadcast.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/quests/service.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/store/index.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/hooks/useQuests.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/lib/websocket.ts`

## Commits

1. `fix(api): wire up quests API handlers`
2. `fix(ws): send quests_init on connect and broadcast updates`
3. `fix(store): handle quest WebSocket messages correctly`
