/**
 * API request handlers
 */

import { createLogger } from '../lib/logger'
import { processHookEvent } from '../events/hooks'
import { pollTmux } from '../tmux'
import * as tmuxCommands from '../tmux/commands'
import { getAllPersonas, getPersonaById } from '../personas'
import { getAllProjects, getProjectById, getOrCreateProject } from '../projects'
import { getAllCompanions, getCompanionById } from '../companions'
import { getProjectTeamStats } from '../projects/aggregation'
import { generateNarrative } from '../projects/narrative'
import { getActiveQuests, getQuestById, updateQuestStatus } from '../quests'
import { getXpByCategory, getXpTimeline } from '../xp'
import { getAllCompetitions } from '../competitions'
import { isWhisperAvailable, transcribeAudio as whisperTranscribe } from '../lib/whisper'
import { cloneRepo } from '../projects/clone'
import { createNote, getNoteById, getAllNotes, updateNote, deleteNote } from '../notes'
import { createGitHubIssue } from '../notes/github'
import { getAllChallenges, getChallengeDefinition } from '../personas/challenges'
import { serveAvatar } from './avatars'
import type { Note, NoteStatus } from '../notes'
import type {
  ApiResponse,
  CreateWindowRequest,
  RenameWindowRequest,
  SendPromptRequest,
  SendSignalRequest,
  HookEventRequest,
  UpdateQuestRequest,
  TranscribeResponse,
  CloneRequest,
  CreateNoteRequest,
  UpdateNoteRequest,
  CreateIssueFromNoteRequest,
} from './types'
import type { QuestStatus } from '../quests/types'
import type { CloneResult } from '../projects/clone'

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
 * Get challenges for a persona
 */
export function getPersonaChallenges(params: Record<string, string>): ApiResponse<unknown> {
  const persona = getPersonaById(params.id)
  if (!persona) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Persona not found' },
    }
  }

  const challenges = getAllChallenges(params.id).map((challenge) => {
    const definition = getChallengeDefinition(challenge.challengeId)
    return {
      ...challenge,
      name: definition?.name || 'Unknown Challenge',
      description: definition?.description || '',
    }
  })
  return { success: true, data: { challenges } }
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
 * Get project narrative
 */
export function getProjectNarrative(
  params: Record<string, string>,
  query: URLSearchParams
): ApiResponse<unknown> {
  const project = getProjectById(params.id)
  if (!project) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    }
  }

  const format = query.get('format') || 'json'

  try {
    const teamStats = getProjectTeamStats(params.id)
    const narrative = generateNarrative(
      project.id,
      project.name,
      project.level,
      project.projectClass,
      teamStats
    )

    // Return based on requested format
    if (format === 'markdown') {
      return { success: true, data: narrative.markdown }
    }

    // Default: return full JSON structure with team stats
    return { success: true, data: { ...narrative, teamStats } }
  } catch (error) {
    log.error('Failed to generate narrative', {
      projectId: params.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: { code: 'GENERATION_FAILED', message: 'Failed to generate narrative' },
    }
  }
}

/**
 * Clone a GitHub repository
 */
export async function cloneGitHubRepo(body: CloneRequest): Promise<ApiResponse<CloneResult>> {
  // Validate URL is provided
  if (!body.url || typeof body.url !== 'string' || body.url.trim() === '') {
    return {
      success: false,
      error: { code: 'MISSING_URL', message: 'URL is required' },
    }
  }

  const url = body.url.trim()

  // Validate URL format (basic GitHub URL check)
  const isValidGitHubUrl =
    url.includes('github.com') ||
    url.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/) ||
    url.startsWith('git@github.com:')

  if (!isValidGitHubUrl) {
    return {
      success: false,
      error: { code: 'INVALID_URL', message: 'Invalid GitHub URL' },
    }
  }

  try {
    // Clone the repository
    const result = await cloneRepo(url)

    if (!result.success) {
      return {
        success: false,
        error: { code: 'CLONE_FAILED', message: result.error || 'Clone failed' },
      }
    }

    // If successfully cloned (not already exists), try to register it as a project
    if (result.path && !result.alreadyExists) {
      try {
        await getOrCreateProject(result.path)
        log.info('Registered new project', { path: result.path })
      } catch (error) {
        // Non-fatal: repo was cloned successfully even if project registration failed
        log.warn('Failed to register project', {
          path: result.path,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      success: true,
      data: {
        success: result.success,
        path: result.path,
        alreadyExists: result.alreadyExists,
      },
    }
  } catch (error) {
    log.error('Clone operation failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: {
        code: 'CLONE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to clone repository',
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANIONS (Projects with full stats, streaks, achievements)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all companions
 */
export function listCompanions(): ApiResponse<unknown> {
  const companions = getAllCompanions()
  return { success: true, data: { companions } }
}

/**
 * List all competitions (leaderboards)
 */
export function listCompetitions(): ApiResponse<unknown> {
  const competitions = getAllCompetitions()
  return { success: true, data: { competitions } }
}

/**
 * Get companion by ID
 */
export function getCompanion(params: Record<string, string>): ApiResponse<unknown> {
  const companion = getCompanionById(params.id)
  if (!companion) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Companion not found' },
    }
  }
  return { success: true, data: { companion } }
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
// NOTES ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all notes, optionally filtered by status
 */
export function listNotes(query: URLSearchParams): ApiResponse<{ notes: Note[] }> {
  const status = query.get('status') as NoteStatus | null

  try {
    const notes = status ? getAllNotes(status) : getAllNotes()
    return { success: true, data: { notes } }
  } catch (error) {
    log.error('Failed to list notes', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: { code: 'QUERY_FAILED', message: 'Failed to list notes' },
    }
  }
}

/**
 * Create a new note
 */
export function createNoteHandler(body: CreateNoteRequest): ApiResponse<{ note: Note }> {
  if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
    return {
      success: false,
      error: { code: 'INVALID_CONTENT', message: 'Content is required' },
    }
  }

  try {
    const note = createNote(body.content.trim(), body.tags || [])
    return { success: true, data: { note } }
  } catch (error) {
    log.error('Failed to create note', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create note' },
    }
  }
}

/**
 * Get a note by ID
 */
export function getNote(params: Record<string, string>): ApiResponse<{ note: Note }> {
  const note = getNoteById(params.id)
  if (!note) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Note not found' },
    }
  }
  return { success: true, data: { note } }
}

/**
 * Update a note
 */
export function updateNoteHandler(
  params: Record<string, string>,
  body: UpdateNoteRequest
): ApiResponse<{ note: Note }> {
  // Validate that at least one field is being updated
  if (!body.content && !body.tags && !body.status) {
    return {
      success: false,
      error: { code: 'NO_UPDATES', message: 'No updates provided' },
    }
  }

  // Validate status if provided
  if (body.status && !['inbox', 'triaged', 'archived', 'converted'].includes(body.status)) {
    return {
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Invalid status value' },
    }
  }

  try {
    const updates: { content?: string; tags?: string[]; status?: NoteStatus } = {}

    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim() === '') {
        return {
          success: false,
          error: { code: 'INVALID_CONTENT', message: 'Content must be a non-empty string' },
        }
      }
      updates.content = body.content.trim()
    }

    if (body.tags !== undefined) {
      updates.tags = body.tags
    }

    if (body.status !== undefined) {
      updates.status = body.status as NoteStatus
    }

    const note = updateNote(params.id, updates)
    if (!note) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found' },
      }
    }

    return { success: true, data: { note } }
  } catch (error) {
    log.error('Failed to update note', {
      id: params.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update note' },
    }
  }
}

/**
 * Delete a note
 */
export function deleteNoteHandler(params: Record<string, string>): ApiResponse<{ deleted: boolean }> {
  try {
    const deleted = deleteNote(params.id)
    if (!deleted) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found' },
      }
    }
    return { success: true, data: { deleted: true } }
  } catch (error) {
    log.error('Failed to delete note', {
      id: params.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete note' },
    }
  }
}

/**
 * Create a GitHub issue from a note
 */
export async function createIssueFromNote(
  params: Record<string, string>,
  body: CreateIssueFromNoteRequest
): Promise<ApiResponse<{ issueUrl: string }>> {
  // Validate repo is provided
  if (!body.repo || typeof body.repo !== 'string' || body.repo.trim() === '') {
    return {
      success: false,
      error: { code: 'MISSING_REPO', message: 'Repository is required' },
    }
  }

  try {
    // Get the note
    const note = getNoteById(params.id)
    if (!note) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Note not found' },
      }
    }

    // Extract title (first line of content) or use provided title
    const title = body.title || note.content.split('\n')[0].trim()

    // Create the issue
    const result = await createGitHubIssue({
      title,
      body: note.content,
      repo: body.repo.trim(),
      labels: body.labels,
    })

    if (!result.success) {
      return {
        success: false,
        error: { code: 'CREATE_FAILED', message: result.error || 'Failed to create issue' },
      }
    }

    // Update note status to converted and store issue URL in tags
    const issueUrl = result.issueUrl!
    const updatedTags = [...note.tags, `issue:${issueUrl}`]
    updateNote(params.id, { status: 'converted', tags: updatedTags })

    return {
      success: true,
      data: { issueUrl },
    }
  } catch (error) {
    log.error('Failed to create issue from note', {
      id: params.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create GitHub issue' },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AVATARS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serve cached avatar SVG
 * Note: Returns raw Response, not ApiResponse (serves SVG directly)
 */
export async function getAvatar(params: Record<string, string>): Promise<Response> {
  return serveAvatar(params.seed)
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
