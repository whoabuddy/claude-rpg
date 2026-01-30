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
import { getSession, updateFromHook, clearError } from '../sessions/manager'
import { getProjectById } from '../projects'
import type { PostToolUseEvent, UserPromptEvent, StopEvent, PreToolUseEvent } from './types'

const log = createLogger('event-handlers')

/**
 * Initialize event handlers
 */
export function initEventHandlers(): void {
  // Initialize challenge system with XP service
  initChallengeSystem(addXp)

  // Handle pre-tool-use events (set status to working)
  eventBus.on<PreToolUseEvent>('hook:pre_tool_use', async (event) => {
    try {
      // Ensure persona exists for this session (first hook event creates it)
      const persona = await getOrCreatePersona(event.sessionId)

      // Get session and link persona if not already linked
      const session = getSession(event.paneId)
      if (session && !session.personaId) {
        session.personaId = persona.id
        log.debug('Linked persona to session (first hook)', { paneId: event.paneId, personaId: persona.id })
      }

      // Update session status to working
      await updateFromHook(event.paneId, 'working')

      log.debug('Pre-tool-use processed', {
        paneId: event.paneId,
        toolName: event.toolName,
      })
    } catch (error) {
      log.error('Failed to process pre-tool-use', {
        paneId: event.paneId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  // Handle user prompt events (energy replenishment + challenge tracking)
  eventBus.on<UserPromptEvent>('hook:user_prompt', async (event) => {
    try {
      // Ensure persona exists for this session (first hook event creates it)
      const persona = await getOrCreatePersona(event.sessionId)

      // Get session and link persona if not already linked
      const session = getSession(event.paneId)
      if (session && !session.personaId) {
        session.personaId = persona.id
        log.debug('Linked persona to session (first hook)', { paneId: event.paneId, personaId: persona.id })
      }

      // Update session status to typing
      await updateFromHook(event.paneId, 'typing')

      // Clear any previous error state when user submits new prompt
      clearError(event.paneId)

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
      // Ensure persona exists for this session (first hook event creates it)
      const persona = await getOrCreatePersona(event.sessionId)

      // Get session and link persona if not already linked
      const session = getSession(event.paneId)
      if (session && !session.personaId) {
        session.personaId = persona.id
        log.debug('Linked persona to session (first hook)', { paneId: event.paneId, personaId: persona.id })
      }

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

      // Update companion stats if we have a project (isolated errors)
      if (projectId) {
        try {
          // Track tool usage
          incrementStat(projectId, `toolsUsed.${event.toolName}`, 1)
          incrementStat(projectId, 'promptsReceived', 1)

          // Update streak (daily activity tracking)
          updateStreak(projectId)
        } catch (error) {
          log.error('Failed to update companion stats', {
            projectId,
            toolName: event.toolName,
            error: error instanceof Error ? error.message : String(error),
          })
          // Continue - don't let stat failures break XP tracking
        }
      }

      // Update persona XP (this also checks for level ups and badges)
      addXp(persona.id, xpAmount)

      // Handle error state: set on failure, clear on success
      if (event.success === false) {
        // Set error state
        if (session) {
          session.lastError = {
            tool: event.toolName,
            message: typeof event.output === 'string' ? event.output : undefined,
            timestamp: Date.now(),
          }
        }
        await updateFromHook(event.paneId, 'error')
      } else {
        // Clear error state on successful tool use
        clearError(event.paneId)
      }

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
            try { incrementStat(projectId, 'commands.testsRun', 1) } catch {}
          }
        }
        if (output.includes('git commit')) {
          moraleDelta += MORALE_GAIN_COMMIT
          updateChallengeProgress(persona.id, 'git.commits', 1)
          if (projectId) {
            try { incrementStat(projectId, 'git.commits', 1) } catch {}
          }
        }
        if (output.includes('git push')) {
          if (projectId) {
            try { incrementStat(projectId, 'git.pushes', 1) } catch {}
          }
        }
        if (output.includes('npm run build') || output.includes('bun run build')) {
          if (projectId) {
            try { incrementStat(projectId, 'commands.buildsRun', 1) } catch {}
          }
        }
        if (output.includes('npm run lint') || output.includes('eslint')) {
          if (projectId) {
            try { incrementStat(projectId, 'commands.lintsRun', 1) } catch {}
          }
        }
        if (output.includes('clarinet check')) {
          if (projectId) {
            try { incrementStat(projectId, 'blockchain.clarinetChecks', 1) } catch {}
          }
        }
        if (output.includes('clarinet test')) {
          if (projectId) {
            try { incrementStat(projectId, 'blockchain.clarinetTests', 1) } catch {}
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
      // Update session status to idle
      await updateFromHook(event.paneId, 'idle')

      // Clear error state when transitioning to idle
      clearError(event.paneId)

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
