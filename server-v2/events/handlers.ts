/**
 * Event handlers for persona XP integration
 */

import { createLogger } from '../lib/logger'
import { eventBus } from './bus'
import { getOrCreatePersona, addXp, updateHealth } from '../personas/service'
import { calculateXp } from '../xp/calculator'
import { recordXpEvent } from '../xp/ledger'
import {
  ENERGY_GAIN_PROMPT,
  ENERGY_GAIN_TOOL_USE,
  MORALE_GAIN_SUCCESS,
  MORALE_LOSS_ERROR,
  MORALE_GAIN_TEST_PASS,
  MORALE_GAIN_COMMIT,
} from '../personas/health'
import {
  updateChallengeProgress,
  autoAssignChallenges,
  initChallengeSystem,
} from '../personas/challenges'
import type { PostToolUseEvent, UserPromptEvent } from './types'

const log = createLogger('event-handlers')

/**
 * Initialize event handlers
 */
export function initEventHandlers(): void {
  // Initialize challenge system with XP service
  initChallengeSystem(addXp)

  // Handle user prompt events (energy replenishment + challenge tracking)
  eventBus.on<UserPromptEvent>('hook:user_prompt', async (event) => {
    try {
      const persona = await getOrCreatePersona(event.sessionId)

      // Replenish energy and auto-assign challenges if needed
      updateHealth(persona.id, ENERGY_GAIN_PROMPT, 0)
      autoAssignChallenges(persona.id)

      // Update prompt challenge progress
      updateChallengeProgress(persona.id, 'promptsReceived', 1)

      log.debug('User prompt processed', {
        personaId: persona.id,
        paneId: event.paneId,
      })
    } catch (error) {
      log.error('Failed to process user prompt', {
        sessionId: event.sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

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

      // Update health and challenges
      const energyDelta = ENERGY_GAIN_TOOL_USE
      let moraleDelta = event.success !== false ? MORALE_GAIN_SUCCESS : -MORALE_LOSS_ERROR

      // Check for test/commit commands for bonus morale
      if (event.toolName === 'Bash' && event.output) {
        const output = typeof event.output === 'string' ? event.output : JSON.stringify(event.output)
        if (output.includes('test') || output.includes('jest') || output.includes('vitest')) {
          moraleDelta += MORALE_GAIN_TEST_PASS
          updateChallengeProgress(persona.id, 'commands.testsRun', 1)
        }
        if (output.includes('git commit')) {
          moraleDelta += MORALE_GAIN_COMMIT
          updateChallengeProgress(persona.id, 'git.commits', 1)
        }
      }

      updateHealth(persona.id, energyDelta, moraleDelta)

      // Update tool usage challenge
      updateChallengeProgress(persona.id, 'toolsUsed', 1)

      log.debug('Persona XP and health updated', {
        personaId: persona.id,
        toolName: event.toolName,
        xpAmount,
        energyDelta,
        moraleDelta,
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
