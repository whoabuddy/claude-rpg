/**
 * API request handlers
 */

import { createLogger } from '../lib/logger'
import { processHookEvent } from '../events/hooks'
import { pollTmux } from '../tmux'
import * as tmuxCommands from '../tmux/commands'
import { getAllPersonas, getPersonaById } from '../personas'
import { getAllProjects, getProjectById } from '../projects'
import { getActiveQuests, getQuestById, updateQuestStatus } from '../quests'
import { getXpByCategory, getXpTimeline } from '../xp'
import { isWhisperAvailable, transcribeAudio as whisperTranscribe } from '../lib/whisper'
import type {
  ApiResponse,
  CreateWindowRequest,
  RenameWindowRequest,
  SendPromptRequest,
  SendSignalRequest,
  HookEventRequest,
  UpdateQuestRequest,
  TranscribeResponse,
} from './types'
import type { QuestStatus } from '../quests/types'

const log = createLogger('api-handlers')

/**
 * Health check
 */
export function health(): ApiResponse<{ status: string; timestamp: string }> {
  return {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Handle Claude hook event
 */
export async function handleEvent(body: HookEventRequest): Promise<ApiResponse<{ received: boolean }>> {
  const eventType = body.event_type || body.eventType || 'unknown'

  try {
    await processHookEvent(eventType, body)
    return { success: true, data: { received: true } }
  } catch (error) {
    log.error('Failed to process hook event', {
      eventType,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: { code: 'PROCESSING_ERROR', message: 'Failed to process event' },
    }
  }
}

/**
 * List all windows with panes
 */
export async function listWindows(): Promise<ApiResponse<unknown>> {
  try {
    const state = await pollTmux()
    return { success: true, data: state }
  } catch (error) {
    return {
      success: false,
      error: { code: 'TMUX_ERROR', message: 'Failed to list windows' },
    }
  }
}

/**
 * Create a new window
 */
export async function createWindow(body: CreateWindowRequest): Promise<ApiResponse<{ windowId: string }>> {
  try {
    const sessionName = body.sessionName || 'main'
    const windowId = await tmuxCommands.createWindow(sessionName, body.windowName)
    return { success: true, data: { windowId } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create window' },
    }
  }
}

/**
 * Rename a window
 */
export async function renameWindow(
  params: Record<string, string>,
  body: RenameWindowRequest
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    await tmuxCommands.renameWindow(params.id, body.windowName)
    return { success: true, data: { success: true } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'RENAME_FAILED', message: 'Failed to rename window' },
    }
  }
}

/**
 * Close a window
 */
export async function closeWindow(params: Record<string, string>): Promise<ApiResponse<{ success: boolean }>> {
  try {
    await tmuxCommands.closeWindow(params.id)
    return { success: true, data: { success: true } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'CLOSE_FAILED', message: 'Failed to close window' },
    }
  }
}

/**
 * Create a new pane in a window
 */
export async function newPane(params: Record<string, string>): Promise<ApiResponse<{ paneId: string }>> {
  try {
    const paneId = await tmuxCommands.createPane(params.id)
    return { success: true, data: { paneId } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'SPLIT_FAILED', message: 'Failed to create pane' },
    }
  }
}

/**
 * Create a new pane with Claude Code
 */
export async function newClaude(params: Record<string, string>): Promise<ApiResponse<{ paneId: string }>> {
  try {
    const paneId = await tmuxCommands.createPane(params.id)
    await tmuxCommands.sendKeys(paneId, 'claude', true)
    return { success: true, data: { paneId } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'CLAUDE_FAILED', message: 'Failed to start Claude' },
    }
  }
}

/**
 * Send prompt to a pane
 */
export async function sendPrompt(
  params: Record<string, string>,
  body: SendPromptRequest
): Promise<ApiResponse<{ sent: boolean }>> {
  try {
    const submit = body.submit !== false
    await tmuxCommands.sendKeys(params.id, body.prompt, submit)
    return { success: true, data: { sent: true } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'SEND_FAILED', message: 'Failed to send prompt' },
    }
  }
}

/**
 * Send signal to a pane
 */
export async function sendSignal(
  params: Record<string, string>,
  body: SendSignalRequest
): Promise<ApiResponse<{ sent: boolean }>> {
  try {
    // For now, just send the signal as keys (e.g., C-c for SIGINT)
    const keyMap: Record<string, string> = {
      SIGINT: 'C-c',
      SIGQUIT: 'C-\\',
      SIGTSTP: 'C-z',
    }
    const key = keyMap[body.signal] || body.signal
    await tmuxCommands.sendKeys(params.id, key, false)
    return { success: true, data: { sent: true } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'SIGNAL_FAILED', message: 'Failed to send signal' },
    }
  }
}

/**
 * Dismiss waiting status on a pane
 */
export async function dismissPane(params: Record<string, string>): Promise<ApiResponse<{ dismissed: boolean }>> {
  // This is handled by the session manager via event
  return { success: true, data: { dismissed: true } }
}

/**
 * Refresh a pane (scroll to bottom)
 */
export async function refreshPane(params: Record<string, string>): Promise<ApiResponse<{ refreshed: boolean }>> {
  try {
    await tmuxCommands.sendKeys(params.id, 'C-l', false)
    return { success: true, data: { refreshed: true } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'REFRESH_FAILED', message: 'Failed to refresh pane' },
    }
  }
}

/**
 * Close a pane
 */
export async function closePane(params: Record<string, string>): Promise<ApiResponse<{ closed: boolean }>> {
  try {
    await tmuxCommands.closePane(params.id)
    return { success: true, data: { closed: true } }
  } catch (error) {
    return {
      success: false,
      error: { code: 'CLOSE_FAILED', message: 'Failed to close pane' },
    }
  }
}

/**
 * List all personas
 */
export function listPersonas(): ApiResponse<unknown> {
  const personas = getAllPersonas()
  return { success: true, data: { personas } }
}

/**
 * Get persona by ID
 */
export function getPersona(params: Record<string, string>): ApiResponse<unknown> {
  const persona = getPersonaById(params.id)
  if (!persona) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Persona not found' },
    }
  }
  return { success: true, data: { persona } }
}

/**
 * List all projects
 */
export function listProjects(): ApiResponse<unknown> {
  const projects = getAllProjects()
  return { success: true, data: { projects } }
}

/**
 * Get project by ID
 */
export function getProject(params: Record<string, string>): ApiResponse<unknown> {
  const project = getProjectById(params.id)
  if (!project) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    }
  }
  return { success: true, data: { project } }
}

/**
 * List all active quests
 */
export function listQuests(): ApiResponse<unknown> {
  const quests = getActiveQuests()
  return { success: true, data: { quests } }
}

/**
 * Get quest by ID
 */
export function getQuest(params: Record<string, string>): ApiResponse<unknown> {
  const quest = getQuestById(params.id)
  if (!quest) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Quest not found' },
    }
  }
  return { success: true, data: { quest } }
}

/**
 * Update quest status
 */
export async function updateQuest(
  params: Record<string, string>,
  body: UpdateQuestRequest
): Promise<ApiResponse<unknown>> {
  try {
    const quest = await updateQuestStatus(params.id, body.status as QuestStatus)
    return { success: true, data: { quest } }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update quest',
      },
    }
  }
}

/**
 * Get XP summary by category
 */
export function xpSummary(query: URLSearchParams): ApiResponse<unknown> {
  const entityType = (query.get('type') as 'persona' | 'project') || 'persona'
  const entityId = query.get('id')

  if (!entityId) {
    return {
      success: false,
      error: { code: 'MISSING_PARAM', message: 'Missing id parameter' },
    }
  }

  const summary = getXpByCategory(entityType, entityId)
  return { success: true, data: { summary } }
}

/**
 * Get XP timeline for charts
 */
export function xpTimeline(query: URLSearchParams): ApiResponse<unknown> {
  const entityType = (query.get('type') as 'persona' | 'project') || 'persona'
  const entityId = query.get('id')
  const days = parseInt(query.get('days') || '30', 10)

  if (!entityId) {
    return {
      success: false,
      error: { code: 'MISSING_PARAM', message: 'Missing id parameter' },
    }
  }

  const timeline = getXpTimeline(entityType, entityId, days)
  return { success: true, data: { timeline } }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (Stubs for v2 - no dev proxy mode)
// ═══════════════════════════════════════════════════════════════════════════

import { getConfig } from '../lib/config'

/**
 * Get backend status (v2 stub - only production mode)
 * Note: Returns raw format (not ApiResponse) for v1 client compatibility
 */
export function adminBackends(): ApiResponse<{ ok: boolean; production: { ok: boolean; port: number }; dev: { ok: boolean; port: number }; activeBackend: string }> {
  const config = getConfig()
  return {
    success: true,
    data: {
      ok: true,
      production: { ok: true, port: config.port },
      dev: { ok: false, port: 0 },
      activeBackend: 'production',
    },
  }
}

/**
 * Switch backend (v2 stub - no-op, always production)
 */
export function adminSwitchBackend(): ApiResponse<{ ok: boolean; mode: string; message: string }> {
  return {
    success: true,
    data: {
      ok: true,
      mode: 'production',
      message: 'Dev proxy mode not available in v2',
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSCRIPTION ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transcribe audio to text using whisper.cpp
 * Returns backward-compatible format: { ok: boolean, text?: string, error?: string }
 * wrapped in ApiResponse for consistency with other endpoints
 */
export async function transcribeAudio(audioData: Buffer): Promise<ApiResponse<TranscribeResponse>> {
  try {
    if (!isWhisperAvailable()) {
      // Return error in backward-compatible format
      return {
        success: true, // HTTP 200 with ok: false for client compatibility
        data: {
          ok: false,
          error: 'Whisper model not found. Please install whisper.cpp and download the model.',
        },
      }
    }

    const text = await whisperTranscribe(audioData)

    return {
      success: true,
      data: {
        ok: true,
        text,
      },
    }
  } catch (error) {
    log.error('Transcription failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    // Return error in backward-compatible format
    return {
      success: true, // HTTP 200 with ok: false for client compatibility
      data: {
        ok: false,
        error: error instanceof Error ? error.message : 'Transcription failed',
      },
    }
  }
}
