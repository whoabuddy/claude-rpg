/**
 * Event handlers for persona XP integration
 */

import { createLogger } from '../lib/logger'
import { eventBus } from './bus'
import { getOrCreatePersona, addXp } from '../personas/service'
import { calculateXp } from '../xp/calculator'
import { recordXpEvent } from '../xp/ledger'
import type { PostToolUseEvent } from './types'

const log = createLogger('event-handlers')

/**
 * Initialize event handlers
 */
export function initEventHandlers(): void {
  // Handle tool use events
  eventBus.on<PostToolUseEvent>('hook:post_tool_use', async (event) => {
    try {
      // Get or create persona for this session
      const persona = await getOrCreatePersona(event.sessionId)

      // Calculate XP for tool use
      const eventType = `tool:${event.toolName}`
      const xpAmount = calculateXp(eventType)

      // Record XP event
      recordXpEvent({
        personaId: persona.id,
        projectId: null, // TODO: Get project from pane context
        eventType,
        amount: xpAmount,
        metadata: {
          toolName: event.toolName,
          success: event.success,
          paneId: event.paneId,
        },
      })

      // Update persona XP (this also checks for level ups and badges)
      addXp(persona.id, xpAmount)

      log.debug('Persona XP updated', {
        personaId: persona.id,
        toolName: event.toolName,
        xpAmount,
      })

      // Emit XP awarded event for WebSocket broadcast
      await eventBus.emit({
        type: 'xp:awarded',
        personaId: persona.id,
        amount: xpAmount,
        eventType,
        metadata: {
          toolName: event.toolName,
          personaName: persona.name,
        },
      })
    } catch (error) {
      log.error('Failed to update persona XP', {
        sessionId: event.sessionId,
        toolName: event.toolName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  log.info('Event handlers initialized')
}
