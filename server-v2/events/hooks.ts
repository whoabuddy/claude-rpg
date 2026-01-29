/**
 * Claude Code hook event processing
 */

import { createLogger } from '../lib/logger'
import { eventBus } from './bus'
import type {
  PreToolUseEvent,
  PostToolUseEvent,
  StopEvent,
  UserPromptEvent,
  NotificationEvent,
} from './types'

const log = createLogger('hooks')

// Event deduplication
const seenEvents = new Map<string, number>()
const DEDUP_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_SEEN_EVENTS = 1000

/**
 * Raw hook payload from Claude Code
 */
interface RawHookPayload {
  // Either snake_case or camelCase
  session_id?: string
  sessionId?: string
  pane_id?: string
  paneId?: string
  tmux_target?: string
  tmuxTarget?: string
  tool_name?: string
  toolName?: string
  tool_use_id?: string
  toolUseId?: string
  success?: boolean
  output?: string
  reason?: string
  prompt?: string
  message?: string
  event_type?: string
  eventType?: string
  hook_type?: string
  hookType?: string
}

/**
 * Normalize hook payload to consistent format
 */
function normalizePayload(raw: RawHookPayload): {
  sessionId: string
  paneId: string
  toolName?: string
  toolUseId?: string
  success?: boolean
  output?: string
  reason?: string
  prompt?: string
  message?: string
} {
  return {
    sessionId: raw.session_id || raw.sessionId || '',
    paneId: raw.pane_id || raw.paneId || raw.tmux_target || raw.tmuxTarget || '',
    toolName: raw.tool_name || raw.toolName,
    toolUseId: raw.tool_use_id || raw.toolUseId,
    success: raw.success,
    output: raw.output,
    reason: raw.reason,
    prompt: raw.prompt,
    message: raw.message,
  }
}

/**
 * Generate dedup key for an event
 */
function getDedupKey(type: string, payload: RawHookPayload): string {
  const sessionId = payload.session_id || payload.sessionId || ''
  const toolUseId = payload.tool_use_id || payload.toolUseId || ''
  return `${type}:${sessionId}:${toolUseId}`
}

/**
 * Check if event was already seen
 */
function isDuplicate(key: string): boolean {
  const seen = seenEvents.get(key)
  if (seen && Date.now() - seen < DEDUP_TTL) {
    return true
  }
  return false
}

/**
 * Mark event as seen
 */
function markSeen(key: string): void {
  // Clean up if too many
  if (seenEvents.size > MAX_SEEN_EVENTS) {
    const now = Date.now()
    for (const [k, time] of seenEvents.entries()) {
      if (now - time > DEDUP_TTL) {
        seenEvents.delete(k)
      }
    }
  }

  seenEvents.set(key, Date.now())
}

/**
 * Process incoming hook event
 */
export async function processHookEvent(
  eventType: string,
  payload: RawHookPayload
): Promise<void> {
  // Dedup check
  const dedupKey = getDedupKey(eventType, payload)
  if (isDuplicate(dedupKey)) {
    log.debug('Duplicate event skipped', { eventType, dedupKey })
    return
  }
  markSeen(dedupKey)

  const normalized = normalizePayload(payload)

  if (!normalized.paneId) {
    log.warn('Event missing paneId', { eventType })
    return
  }

  log.debug('Processing hook event', { eventType, paneId: normalized.paneId })

  // Emit typed event
  switch (eventType) {
    case 'pre_tool_use':
      await eventBus.emit<PreToolUseEvent>({
        type: 'hook:pre_tool_use',
        paneId: normalized.paneId,
        sessionId: normalized.sessionId,
        toolName: normalized.toolName || '',
        toolUseId: normalized.toolUseId || '',
      })
      break

    case 'post_tool_use':
      await eventBus.emit<PostToolUseEvent>({
        type: 'hook:post_tool_use',
        paneId: normalized.paneId,
        sessionId: normalized.sessionId,
        toolName: normalized.toolName || '',
        toolUseId: normalized.toolUseId || '',
        success: normalized.success ?? true,
        output: normalized.output,
      })
      break

    case 'stop':
      await eventBus.emit<StopEvent>({
        type: 'hook:stop',
        paneId: normalized.paneId,
        sessionId: normalized.sessionId,
        reason: normalized.reason || 'completed',
      })
      break

    case 'user_prompt_submit':
    case 'user_prompt':
      await eventBus.emit<UserPromptEvent>({
        type: 'hook:user_prompt',
        paneId: normalized.paneId,
        sessionId: normalized.sessionId,
        prompt: normalized.prompt || '',
      })
      break

    case 'notification':
      await eventBus.emit<NotificationEvent>({
        type: 'hook:notification',
        paneId: normalized.paneId,
        sessionId: normalized.sessionId,
        message: normalized.message || '',
      })
      break

    default:
      log.debug('Unknown event type', { eventType })
  }
}

/**
 * Clear dedup cache (for testing)
 */
export function clearDedupCache(): void {
  seenEvents.clear()
}
