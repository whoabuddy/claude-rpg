/**
 * Tests for WebSocket broadcast with backpressure handling
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import type {
  PaneUpdateMessage,
  TerminalOutputMessage,
  WindowsMessage,
  EventMessage,
} from '../api/messages'

// Mock logger before importing broadcast module
mock.module('../lib/logger', () => ({
  createLogger: () => ({
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  }),
}))

// Import broadcast module after mocking
const broadcastModule = await import('../api/broadcast')
const { addClient, removeClient, broadcast, getClientCount } = broadcastModule

describe('WebSocket Broadcast', () => {
  // Mock WebSocket client factory
  function createMockClient(bufferedAmount = 0, readyState = 1): ServerWebSocket<unknown> {
    const sentMessages: string[] = []

    const client = {
      readyState,
      bufferedAmount,
      send: mock((data: string) => {
        sentMessages.push(data)
      }),
      close: mock(() => {}),
      // Internal reference for test assertions
      _sentMessages: sentMessages,
    } as unknown as ServerWebSocket<unknown>

    return client
  }

  beforeEach(() => {
    // Clear all clients before each test
    const clients = broadcastModule.getClients()
    for (const client of clients) {
      removeClient(client)
    }
  })

  describe('Client Management', () => {
    test('should add and remove clients', () => {
      const client1 = createMockClient()
      const client2 = createMockClient()

      addClient(client1)
      expect(getClientCount()).toBe(1)

      addClient(client2)
      expect(getClientCount()).toBe(2)

      removeClient(client1)
      expect(getClientCount()).toBe(1)

      removeClient(client2)
      expect(getClientCount()).toBe(0)
    })

    test('should handle removing non-existent client', () => {
      const client = createMockClient()
      removeClient(client) // Should not throw
      expect(getClientCount()).toBe(0)
    })
  })

  describe('Message Priority', () => {
    test('should send high priority messages even with backpressure', () => {
      // Create client with high buffered amount (64KB+)
      const client = createMockClient(70 * 1024, 1)
      addClient(client)

      // High priority: pane_update
      const paneUpdate: PaneUpdateMessage = {
        type: 'pane_update',
        paneId: 'pane1',
        session: {
          paneId: 'pane1',
          sessionId: 'sess1',
          name: 'Test',
          avatar: '',
          status: 'working',
          startTime: new Date().toISOString(),
        },
      }

      broadcast(paneUpdate)

      const sent = (client as unknown as { _sentMessages: string[] })._sentMessages
      expect(sent.length).toBe(1)
      expect(JSON.parse(sent[0]).type).toBe('pane_update')
    })

    test('should send terminal_output messages even with backpressure', () => {
      // Create client with high buffered amount
      const client = createMockClient(70 * 1024, 1)
      addClient(client)

      // High priority: terminal_output
      const terminalMsg: TerminalOutputMessage = {
        type: 'terminal_output',
        payload: {
          paneId: 'pane1',
          target: '%0',
          content: 'terminal content',
        },
      }

      broadcast(terminalMsg)

      const sent = (client as unknown as { _sentMessages: string[] })._sentMessages
      expect(sent.length).toBe(1)
      expect(JSON.parse(sent[0]).type).toBe('terminal_output')
    })

    test('should skip normal priority messages when client is paused', () => {
      // Create client with high buffered amount
      const client = createMockClient(70 * 1024, 1)
      addClient(client)

      // Normal priority: windows
      const windowsMsg: WindowsMessage = {
        type: 'windows',
        payload: [],
      }

      broadcast(windowsMsg)

      const sent = (client as unknown as { _sentMessages: string[] })._sentMessages
      expect(sent.length).toBe(0) // Should be skipped
    })

    test('should skip low priority messages when client is paused', () => {
      // Create client with high buffered amount
      const client = createMockClient(70 * 1024, 1)
      addClient(client)

      // Low priority: event
      const eventMsg: EventMessage = {
        type: 'event',
        payload: {
          eventType: 'test',
          timestamp: new Date().toISOString(),
        },
      }

      broadcast(eventMsg)

      const sent = (client as unknown as { _sentMessages: string[] })._sentMessages
      expect(sent.length).toBe(0) // Should be skipped
    })
  })

  describe('Backpressure State Transitions', () => {
    test('should pause client when buffer exceeds 64KB', () => {
      const client = createMockClient(70 * 1024, 1)
      addClient(client)

      // Send normal priority message - should be skipped
      const windowsMsg: WindowsMessage = {
        type: 'windows',
        payload: [],
      }

      broadcast(windowsMsg)

      const sent = (client as unknown as { _sentMessages: string[] })._sentMessages
      expect(sent.length).toBe(0) // Client is paused
    })

    test('should resume client when buffer drops below 16KB', () => {
      // Start with high buffer
      const client = createMockClient(70 * 1024, 1) as unknown as {
        bufferedAmount: number
        _sentMessages: string[]
      }
      addClient(client as unknown as ServerWebSocket<unknown>)

      // Send message - should be skipped (client paused)
      const msg1: WindowsMessage = { type: 'windows', payload: [] }
      broadcast(msg1)
      expect(client._sentMessages.length).toBe(0)

      // Reduce buffer below 16KB
      client.bufferedAmount = 10 * 1024

      // Send another message - should go through (client resumed)
      const msg2: WindowsMessage = { type: 'windows', payload: [] }
      broadcast(msg2)
      expect(client._sentMessages.length).toBe(1)
    })

    test('should send to multiple clients with different buffer states', () => {
      // Client 1: Normal buffer
      const client1 = createMockClient(1024, 1)
      addClient(client1)

      // Client 2: High buffer (paused)
      const client2 = createMockClient(70 * 1024, 1)
      addClient(client2)

      // Send normal priority message
      const windowsMsg: WindowsMessage = {
        type: 'windows',
        payload: [],
      }

      broadcast(windowsMsg)

      // Client 1 should receive (normal buffer)
      const sent1 = (client1 as unknown as { _sentMessages: string[] })._sentMessages
      expect(sent1.length).toBe(1)

      // Client 2 should not receive (paused)
      const sent2 = (client2 as unknown as { _sentMessages: string[] })._sentMessages
      expect(sent2.length).toBe(0)
    })
  })

  describe('Client State Handling', () => {
    test('should skip clients not in OPEN state', () => {
      // readyState 0 = CONNECTING
      const connectingClient = createMockClient(0, 0)
      addClient(connectingClient)

      // readyState 2 = CLOSING
      const closingClient = createMockClient(0, 2)
      addClient(closingClient)

      // readyState 3 = CLOSED
      const closedClient = createMockClient(0, 3)
      addClient(closedClient)

      const msg: PaneUpdateMessage = {
        type: 'pane_update',
        paneId: 'pane1',
        session: {
          paneId: 'pane1',
          sessionId: 'sess1',
          name: 'Test',
          avatar: '',
          status: 'working',
          startTime: new Date().toISOString(),
        },
      }

      broadcast(msg)

      // None should receive messages
      expect((connectingClient as unknown as { _sentMessages: string[] })._sentMessages.length).toBe(
        0,
      )
      expect((closingClient as unknown as { _sentMessages: string[] })._sentMessages.length).toBe(0)
      expect((closedClient as unknown as { _sentMessages: string[] })._sentMessages.length).toBe(0)
    })

    test('should remove client that throws on send', () => {
      const client = {
        readyState: 1,
        bufferedAmount: 0,
        send: mock(() => {
          throw new Error('Send failed')
        }),
        close: mock(() => {}),
      } as unknown as ServerWebSocket<unknown>

      addClient(client)
      expect(getClientCount()).toBe(1)

      const msg: PaneUpdateMessage = {
        type: 'pane_update',
        paneId: 'pane1',
        session: {
          paneId: 'pane1',
          sessionId: 'sess1',
          name: 'Test',
          avatar: '',
          status: 'working',
          startTime: new Date().toISOString(),
        },
      }

      broadcast(msg)

      // Client should be removed after failed send
      expect(getClientCount()).toBe(0)
    })
  })

  describe('Broadcast with No Clients', () => {
    test('should handle broadcast with no clients', () => {
      const msg: WindowsMessage = {
        type: 'windows',
        payload: [],
      }

      // Should not throw
      broadcast(msg)
      expect(getClientCount()).toBe(0)
    })
  })
})
