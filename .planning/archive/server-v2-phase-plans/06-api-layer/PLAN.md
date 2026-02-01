# Phase 6: API Layer

## Goal
Implement HTTP routes and Bun WebSocket handlers.

## Context
- Bun.serve() handles both HTTP and WebSocket
- Consistent response format across all endpoints
- Backpressure handling for WebSocket broadcasts
- Issues: #125, #126

<plan>
  <goal>Create HTTP API and WebSocket broadcast system</goal>
  <context>
    - Reference existing server/index.ts for endpoint patterns
    - Bun.serve() with fetch handler + websocket config
    - WebSocket backpressure: track buffer size, drop low-priority messages
    - All endpoints return { success: true, data } or { success: false, error }
  </context>

  <task id="1">
    <name>Implement HTTP routes</name>
    <files>server-v2/api/index.ts, server-v2/api/routes.ts, server-v2/api/handlers.ts, server-v2/api/types.ts</files>
    <action>
      1. Create api/types.ts:
         - ApiResponse<T>: { success: true, data: T } | { success: false, error: ApiError }
         - ApiError: { code: string, message: string }
         - Request body types for POST endpoints
      2. Create api/handlers.ts:
         - Health check handler
         - Event handler (POST /event from Claude hooks)
         - Window handlers: list, create, rename, close, new-pane, new-claude
         - Pane handlers: prompt, signal, dismiss, refresh, close
         - Persona handlers: list, get
         - Project handlers: list, get
         - Quest handlers: list, get, update
         - XP handlers: summary, chart data
      3. Create api/routes.ts:
         - Route definitions with method and path
         - Route matching function
         - Parse URL params
      4. Create api/index.ts:
         - Main fetch handler that routes requests
         - JSON body parsing
         - Error handling wrapper
         - CORS headers if needed
    </action>
    <verify>
      Start server, call GET /health, verify response
      Call POST /api/windows/create, verify window created
      Call invalid endpoint, verify 404 response
    </verify>
    <done>All HTTP endpoints implemented with consistent response format</done>
  </task>

  <task id="2">
    <name>Implement Bun WebSocket with backpressure</name>
    <files>server-v2/api/ws.ts, server-v2/api/broadcast.ts, server-v2/api/messages.ts</files>
    <action>
      1. Create api/messages.ts:
         - ServerMessage union type (all message types)
         - MessagePriority: 'high' | 'normal' | 'low'
         - getPriority(message): MessagePriority
      2. Create api/broadcast.ts:
         - Client tracking (Set<ServerWebSocket>)
         - broadcast(message): void
         - Check each client's bufferedAmount
         - Skip low-priority messages if buffer > 64KB
         - Resume when buffer < 16KB
         - Log dropped messages at debug level
      3. Create api/ws.ts:
         - WebSocket handlers for Bun.serve():
           - open(ws): add to clients, send connected message
           - message(ws, msg): handle client messages (if any)
           - close(ws): remove from clients
           - drain(ws): called when buffer clears
         - Heartbeat ping every 30s
      4. Update api/index.ts:
         - Integrate WebSocket upgrade in Bun.serve()
         - Subscribe to event bus and broadcast updates
    </action>
    <verify>
      Connect WebSocket client, verify connected message received
      Trigger state change, verify broadcast received
      Simulate slow client, verify backpressure kicks in
    </verify>
    <done>WebSocket broadcasts with backpressure handling</done>
  </task>

  <task id="3">
    <name>Wire everything together in main server</name>
    <files>server-v2/index.ts</files>
    <action>
      1. Update index.ts to:
         - Initialize all modules in order:
           1. Config
           2. Logger
           3. Database (with migrations)
           4. Event bus
           5. Personas service
           6. Projects service
           7. XP service
           8. Quests service
           9. Sessions manager
           10. Tmux poller
         - Start Bun.serve() with HTTP + WebSocket
         - Register shutdown handlers
         - Log server ready message
      2. Wire event bus subscriptions:
         - Tmux events → session/project updates
         - Hook events → XP awards, session updates
         - All events → WebSocket broadcasts
    </action>
    <verify>
      bun run server-v2/index.ts
      Verify all modules initialize
      Verify HTTP and WebSocket work
      Verify graceful shutdown
    </verify>
    <done>Complete server running with all modules integrated</done>
  </task>
</plan>

## Verification Criteria
- [ ] All HTTP endpoints return proper responses
- [ ] WebSocket upgrade works
- [ ] Clients receive real-time updates
- [ ] Backpressure prevents memory issues
- [ ] Graceful shutdown closes all connections
