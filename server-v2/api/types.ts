/**
 * API types
 */

export interface ApiError {
  code: string
  message: string
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError }

export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  pattern: string
  handler: string
}

// Request body types

export interface CreateWindowRequest {
  sessionName?: string
  windowName?: string
}

export interface RenameWindowRequest {
  windowName: string
}

export interface SendPromptRequest {
  prompt: string
  submit?: boolean
}

export interface SendSignalRequest {
  signal: string
}

export interface HookEventRequest {
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
  event_type?: string
  eventType?: string
  // Claude Code uses hook_event_name, our hook script adds hookType
  hook_event_name?: string
  hookType?: string
  success?: boolean
  output?: string
  reason?: string
  prompt?: string
  message?: string
}

export interface UpdateQuestRequest {
  status: string
}

export interface TranscribeResponse {
  ok: boolean
  text?: string
  error?: string
}

export interface CloneRequest {
  url: string
}

export interface CreateNoteRequest {
  content: string
  tags?: string[]
}

export interface UpdateNoteRequest {
  content?: string
  tags?: string[]
  status?: string
}

export interface CreateIssueFromNoteRequest {
  repo: string
  title?: string
  labels?: string[]
}
