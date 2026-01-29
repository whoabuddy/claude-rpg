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
import { incrementStat, updateStreak } from '../companions'
import { getSession } from '../sessions/manager'
import { getProjectById } from '../projects'
import type { PostToolUseEvent, UserPromptEvent, StopEvent } from './types'

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

      // Get project from pane session
      const session = getSession(event.paneId)
      const projectId = session?.projectId || null
      const project = projectId ? getProjectById(projectId) : null

      // Calculate XP for tool use
      const eventType = `tool:${event.toolName}`
      const xpAmount = calculateXp(eventType)

      // Record XP event
      recordXpEvent({
        personaId: persona.id,
        projectId,
        eventType,
        amount: xpAmount,
        metadata: {
          toolName: event.toolName,
          success: event.success,
          paneId: event.paneId,
        },
      })

      // Update companion stats if we have a project
      if (projectId) {
        // Track tool usage
        incrementStat(projectId, `toolsUsed.${event.toolName}`, 1)
        incrementStat(projectId, 'promptsReceived', 1)

        // Update streak (daily activity tracking)
        updateStreak(projectId)
      }

      // Update persona XP (this also checks for level ups and badges)
      addXp(persona.id, xpAmount)

      // Update health and challenges
      const energyDelta = ENERGY_GAIN_TOOL_USE
      let moraleDelta = event.success !== false ? MORALE_GAIN_SUCCESS : -MORALE_LOSS_ERROR

      // Check for test/commit commands for bonus morale and companion stats
      if (event.toolName === 'Bash' && event.output) {
        const output = typeof event.output === 'string' ? event.output : JSON.stringify(event.output)
        if (output.includes('test') || output.includes('jest') || output.includes('vitest')) {
          moraleDelta += MORALE_GAIN_TEST_PASS
          updateChallengeProgress(persona.id, 'commands.testsRun', 1)
          if (projectId) {
            incrementStat(projectId, 'commands.testsRun', 1)
          }
        }
        if (output.includes('git commit')) {
          moraleDelta += MORALE_GAIN_COMMIT
          updateChallengeProgress(persona.id, 'git.commits', 1)
          if (projectId) {
            incrementStat(projectId, 'git.commits', 1)
          }
        }
        if (output.includes('git push')) {
          if (projectId) {
            incrementStat(projectId, 'git.pushes', 1)
          }
        }
        if (output.includes('npm run build') || output.includes('bun run build')) {
          if (projectId) {
            incrementStat(projectId, 'commands.buildsRun', 1)
          }
        }
        if (output.includes('npm run lint') || output.includes('eslint')) {
          if (projectId) {
            incrementStat(projectId, 'commands.lintsRun', 1)
          }
        }
        if (output.includes('clarinet check')) {
          if (projectId) {
            incrementStat(projectId, 'blockchain.clarinetChecks', 1)
          }
        }
        if (output.includes('clarinet test')) {
          if (projectId) {
            incrementStat(projectId, 'blockchain.clarinetTests', 1)
          }
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

  // Handle stop events (session completed)
  eventBus.on<StopEvent>('hook:stop', async (event) => {
    try {
      const session = getSession(event.paneId)
      const projectId = session?.projectId || null

      if (projectId) {
        // Track session completion
        incrementStat(projectId, 'sessionsCompleted', 1)
        updateStreak(projectId)

        log.debug('Session completed, companion stats updated', {
          paneId: event.paneId,
          projectId,
        })
      }
    } catch (error) {
      log.error('Failed to update companion stats on stop', {
        paneId: event.paneId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  log.info('Event handlers initialized')
}
