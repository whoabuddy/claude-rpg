/**
 * Typed event bus
 */

import { createLogger } from '../lib/logger'
import type { AppEvent, EventType } from './types'

const log = createLogger('event-bus')

type EventHandler<T extends AppEvent = AppEvent> = (event: T) => Promise<void> | void

interface RegisteredHandler {
  type: EventType | '*'
  handler: EventHandler
  priority: number
}

/**
 * Event bus for decoupled communication
 */
class EventBus {
  private handlers: RegisteredHandler[] = []
  private eventCounts = new Map<EventType, number>()

  /**
   * Subscribe to an event type
   * @param type - Event type to subscribe to, or '*' for all events
   * @param handler - Handler function
   * @param priority - Higher priority runs first (default 0)
   */
  on<T extends AppEvent>(
    type: T['type'] | '*',
    handler: EventHandler<T>,
    priority = 0
  ): () => void {
    const registration: RegisteredHandler = {
      type,
      handler: handler as EventHandler,
      priority,
    }

    this.handlers.push(registration)
    this.handlers.sort((a, b) => b.priority - a.priority)

    log.debug('Handler registered', { type, priority, total: this.handlers.length })

    // Return unsubscribe function
    return () => {
      const index = this.handlers.indexOf(registration)
      if (index !== -1) {
        this.handlers.splice(index, 1)
        log.debug('Handler unregistered', { type })
      }
    }
  }

  /**
   * Unsubscribe all handlers for a type
   */
  off(type: EventType | '*'): void {
    const before = this.handlers.length
    this.handlers = this.handlers.filter(h => h.type !== type)
    log.debug('Handlers removed', { type, removed: before - this.handlers.length })
  }

  /**
   * Emit an event
   */
  async emit<T extends AppEvent>(event: T): Promise<void> {
    const type = event.type

    // Track event counts
    const count = (this.eventCounts.get(type) || 0) + 1
    this.eventCounts.set(type, count)

    log.debug('Event emitted', { type, eventNumber: count })

    // Get handlers for this event type
    const handlers = this.handlers.filter(
      h => h.type === type || h.type === '*'
    )

    if (handlers.length === 0) {
      log.debug('No handlers for event', { type })
      return
    }

    // Execute handlers in priority order
    for (const { handler, type: handlerType } of handlers) {
      try {
        await handler(event)
      } catch (error) {
        log.error('Handler error', {
          eventType: type,
          handlerType,
          error: error instanceof Error ? error.message : String(error),
        })
        // Don't rethrow - isolate handler errors
      }
    }
  }

  /**
   * Get handler count for a type
   */
  handlerCount(type?: EventType | '*'): number {
    if (type) {
      return this.handlers.filter(h => h.type === type).length
    }
    return this.handlers.length
  }

  /**
   * Get event count for a type
   */
  eventCount(type: EventType): number {
    return this.eventCounts.get(type) || 0
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.handlers = []
    this.eventCounts.clear()
    log.debug('Event bus cleared')
  }
}

// Singleton instance
export const eventBus = new EventBus()
