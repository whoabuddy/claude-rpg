# Phase 2: Implement WebSocket Heartbeat

## Goal
Keep WebSocket connections alive through Cloudflare tunnel with protocol-level ping/pong, detecting and closing stale connections.

## Context
- Config has `wsHeartbeatInterval: 30000` (30s) but it's never used
- Cloudflare tunnels timeout idle connections after ~100s
- Bun's ServerWebSocket has `ws.ping()` for protocol-level ping
- Browser WebSocket handles pong responses automatically at protocol level
- No client-side code changes needed

<plan>
  <goal>Implement WebSocket heartbeat to keep connections alive through proxy</goal>
  <context>
    - Bun ServerWebSocket has ws.ping() and pong event
    - Browser handles protocol-level pong automatically
    - Config already has wsHeartbeatInterval: 30000
    - Close stale connections after missing 2 pongs (60s)
    - getConfig() returns the interval value
  </context>

  <task id="1">
    <name>Add heartbeat tracking to WsData and handle pong</name>
    <files>server-v2/api/ws.ts, server-v2/api/broadcast.ts</files>
    <action>
      1. In ws.ts, extend WsData interface to add `lastPong: number` timestamp
      2. Initialize `lastPong` to `Date.now()` in the `open` handler
      3. Add handler for pong in message handler (Bun sends pong as message with specific format - check Bun docs)
      4. Actually, Bun has a separate `pong` handler in websocket config - add it to wsHandlers
      5. In broadcast.ts, export `getClients()` function that returns the clients Set
      6. This allows heartbeat module to iterate over clients
    </action>
    <verify>
      - Server starts without TypeScript errors
      - WsData has lastPong field
      - getClients() is exported from broadcast.ts
    </verify>
    <done>WebSocket handlers track last pong time per client</done>
  </task>

  <task id="2">
    <name>Create heartbeat module with ping and stale detection</name>
    <files>server-v2/api/heartbeat.ts (new)</files>
    <action>
      1. Create new file server-v2/api/heartbeat.ts
      2. Import getConfig, getClients, removeClient, createLogger
      3. Create startHeartbeat() function:
         - Get interval from config.wsHeartbeatInterval
         - Set up setInterval that:
           a. Iterates over getClients()
           b. Checks if (now - client.data.lastPong) > interval * 2 (missed 2 pongs)
           c. If stale, log and close the connection
           d. Otherwise, call client.ping() to send ping frame
         - Log heartbeat tick count
      4. Create stopHeartbeat() function to clear the interval
      5. Export both functions
    </action>
    <verify>
      - File compiles without TypeScript errors
      - Functions are properly typed
    </verify>
    <done>Heartbeat module with ping interval and stale detection</done>
  </task>

  <task id="3">
    <name>Wire heartbeat into server lifecycle</name>
    <files>server-v2/index.ts</files>
    <action>
      1. Import startHeartbeat, stopHeartbeat from ./api/heartbeat
      2. After server starts (after Bun.serve), call startHeartbeat()
      3. Register stopHeartbeat in onShutdown with priority 55 (after http-server at 50)
      4. Add info log for heartbeat start
    </action>
    <verify>
      - Server starts and logs "Starting heartbeat"
      - Every 30s, logs heartbeat activity
      - On shutdown, heartbeat stops cleanly
    </verify>
    <done>Heartbeat runs for server lifetime, cleans up on shutdown</done>
  </task>
</plan>

## Commit Messages
- feat(server): add heartbeat tracking to WebSocket handlers
- feat(server): create heartbeat module for connection keepalive
- feat(server): wire heartbeat into server lifecycle

## Notes
- Browser WebSocket handles pong automatically - no client changes needed
- Bun's pong event fires when client responds to ping
- Close connections missing 2 pongs (60s) to handle temporary network issues gracefully
