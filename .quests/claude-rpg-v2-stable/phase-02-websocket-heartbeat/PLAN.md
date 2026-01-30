# Phase 2: WebSocket Heartbeat

## Goal

Keep WebSocket connections alive through Cloudflare tunnel with protocol-level ping/pong, detecting and closing stale connections.

## Context

The server already has `wsHeartbeatInterval: 30000` in config but no implementation. Cloudflare tunnel has a ~100s idle timeout, so 30s ping interval is appropriate. Bun's ServerWebSocket provides `ws.ping()` for protocol-level pings (not application JSON messages). Browser WebSocket handles pong responses automatically at the protocol level.

Current state:
- `server-v2/lib/config.ts` - Has `wsHeartbeatInterval` config (30000ms)
- `server-v2/api/broadcast.ts` - Tracks clients in `Set<ServerWebSocket>`, has `removeClient()`
- `server-v2/api/ws.ts` - WebSocket handlers (open, message, close, drain) with `WsData` interface
- `server-v2/index.ts` - Server lifecycle, uses `onShutdown()` for cleanup
- `src/lib/websocket.ts` - Client reconnects on close, no changes needed (protocol pong is automatic)

Key insight: Browser WebSocket responds to ping frames automatically at the protocol level. No client-side code changes needed.

---

<plan>
  <goal>Implement WebSocket heartbeat with stale connection detection</goal>
  <context>
    Bun ServerWebSocket has ws.ping() for protocol-level pings. The browser responds
    automatically. Track last pong time per client in WsData. Run interval to ping all
    clients and close those that haven't responded.
  </context>

  <task id="1">
    <name>Add heartbeat tracking to WsData and broadcast module</name>
    <files>server-v2/api/ws.ts, server-v2/api/broadcast.ts</files>
    <action>
      1. In server-v2/api/ws.ts, extend WsData interface:
         ```typescript
         export interface WsData {
           sessionId: string
           connectedAt: string
           lastPong: number  // timestamp of last pong received
         }
         ```

      2. In ws.ts open handler, initialize lastPong to Date.now()

      3. In ws.ts, add a pong handler. Bun's websocket config supports a `pong` callback:
         ```typescript
         pong(ws: ServerWebSocket<WsData>): void {
           ws.data.lastPong = Date.now()
           log.debug('Received pong', { sessionId: ws.data.sessionId })
         }
         ```

      4. In server-v2/api/broadcast.ts, export function to get all clients:
         ```typescript
         export function getClients(): Set<ServerWebSocket<unknown>> {
           return clients
         }
         ```
    </action>
    <verify>
      Run: cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun run server-v2/index.ts

      Expected: Server starts without TypeScript errors. Check logs show "Server ready".

      Then kill server (Ctrl+C).
    </verify>
    <done>WsData has lastPong field, pong handler updates it, broadcast exports getClients()</done>
  </task>

  <task id="2">
    <name>Create heartbeat module with ping interval and stale detection</name>
    <files>server-v2/lib/heartbeat.ts (new), server-v2/api/index.ts</files>
    <action>
      1. Create server-v2/lib/heartbeat.ts:
         ```typescript
         /**
          * WebSocket heartbeat - sends pings and closes stale connections
          */
         import type { ServerWebSocket } from 'bun'
         import { createLogger } from './logger'
         import { getConfig } from './config'
         import { getClients, removeClient } from '../api/broadcast'
         import type { WsData } from '../api/ws'

         const log = createLogger('heartbeat')

         let intervalId: ReturnType<typeof setInterval> | null = null
         const MISSED_PONGS_THRESHOLD = 2  // Close after missing 2 pongs

         /**
          * Start heartbeat interval
          */
         export function startHeartbeat(): void {
           const config = getConfig()
           const interval = config.wsHeartbeatInterval

           if (interval <= 0) {
             log.info('Heartbeat disabled (interval <= 0)')
             return
           }

           log.info('Starting heartbeat', { intervalMs: interval })

           intervalId = setInterval(() => {
             const clients = getClients()
             const now = Date.now()
             const staleThreshold = now - (interval * MISSED_PONGS_THRESHOLD)

             let pinged = 0
             let closed = 0

             for (const client of clients) {
               const ws = client as ServerWebSocket<WsData>

               // Check if client is stale (missed multiple pongs)
               if (ws.data.lastPong < staleThreshold) {
                 log.warn('Closing stale connection', {
                   sessionId: ws.data.sessionId,
                   lastPong: new Date(ws.data.lastPong).toISOString(),
                   missedMs: now - ws.data.lastPong,
                 })
                 removeClient(ws)
                 try {
                   ws.close(1000, 'Heartbeat timeout')
                 } catch {
                   // Ignore close errors
                 }
                 closed++
                 continue
               }

               // Send ping
               try {
                 ws.ping()
                 pinged++
               } catch (error) {
                 log.warn('Failed to ping client', {
                   sessionId: ws.data.sessionId,
                   error: error instanceof Error ? error.message : String(error),
                 })
               }
             }

             if (clients.size > 0) {
               log.debug('Heartbeat tick', { pinged, closed, total: clients.size })
             }
           }, interval)
         }

         /**
          * Stop heartbeat interval
          */
         export function stopHeartbeat(): void {
           if (intervalId) {
             clearInterval(intervalId)
             intervalId = null
             log.info('Heartbeat stopped')
           }
         }
         ```

      2. Export from server-v2/api/index.ts (add to existing exports):
         ```typescript
         export { getClients } from './broadcast'
         ```
    </action>
    <verify>
      Run: cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun build --no-bundle server-v2/lib/heartbeat.ts

      Expected: No TypeScript errors. Output shows successful build.
    </verify>
    <done>Heartbeat module exists with startHeartbeat(), stopHeartbeat(), stale detection logic</done>
  </task>

  <task id="3">
    <name>Wire heartbeat into server lifecycle</name>
    <files>server-v2/index.ts</files>
    <action>
      1. Add import at top of server-v2/index.ts:
         ```typescript
         import { startHeartbeat, stopHeartbeat } from './lib/heartbeat'
         ```

      2. After the server starts (after the Bun.serve() call, before "Server ready" log), start heartbeat:
         ```typescript
         // Start WebSocket heartbeat
         startHeartbeat()

         onShutdown('ws-heartbeat', () => {
           log.info('Stopping WebSocket heartbeat')
           stopHeartbeat()
         }, 55)  // Between tmux-poller (60) and http-server (50)
         ```

      3. Also update the websocket handlers in wsHandlers to include pong. Since wsHandlers
         is imported from './api', update server-v2/api/ws.ts to export the pong handler
         in wsHandlers object:
         ```typescript
         export const wsHandlers = {
           open(ws: ServerWebSocket<WsData>): void { ... },
           message(ws: ServerWebSocket<WsData>, message: string | Buffer): void { ... },
           close(ws: ServerWebSocket<WsData>, code: number, reason: string): void { ... },
           drain(ws: ServerWebSocket<WsData>): void { ... },
           pong(ws: ServerWebSocket<WsData>): void {
             ws.data.lastPong = Date.now()
             log.debug('Received pong', { sessionId: ws.data.sessionId })
           },
         }
         ```
    </action>
    <verify>
      1. Start server: cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun run server-v2/index.ts
         Expected: Log shows "Starting heartbeat" with intervalMs: 30000

      2. Connect browser to http://localhost:4011 (or tunnel URL)
         Expected: WebSocket connects, "WebSocket client connected" in logs

      3. Wait 30+ seconds
         Expected: Log shows "Heartbeat tick" with pinged: 1

      4. Kill server (Ctrl+C)
         Expected: Logs show shutdown handlers running, including "Stopping WebSocket heartbeat"
    </verify>
    <done>Server starts heartbeat on startup, stops on shutdown, pong handler updates lastPong</done>
  </task>
</plan>
