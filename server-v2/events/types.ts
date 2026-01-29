/**
 * Event types for the event bus
 */

import type { TmuxPane, TmuxWindow } from '../tmux/types'

// Tmux events
export interface PaneDiscoveredEvent {
  type: 'pane:discovered'
  pane: TmuxPane
}

export interface PaneRemovedEvent {
  type: 'pane:removed'
  paneId: string
}

export interface PaneChangedEvent {
  type: 'pane:changed'
  pane: TmuxPane
  changes: string[]
}

export interface WindowCreatedEvent {
  type: 'window:created'
  window: TmuxWindow
}

export interface WindowRemovedEvent {
  type: 'window:removed'
  windowId: string
}

// Hook events (from Claude Code)
export interface PreToolUseEvent {
  type: 'hook:pre_tool_use'
  paneId: string
  sessionId: string
  toolName: string
  toolUseId: string
}

export interface PostToolUseEvent {
  type: 'hook:post_tool_use'
  paneId: string
  sessionId: string
  toolName: string
  toolUseId: string
  success: boolean
  output?: string
}

export interface StopEvent {
  type: 'hook:stop'
  paneId: string
  sessionId: string
  reason: string
}

export interface UserPromptEvent {
  type: 'hook:user_prompt'
  paneId: string
  sessionId: string
  prompt: string
}

export interface NotificationEvent {
  type: 'hook:notification'
  paneId: string
  sessionId: string
  message: string
}

// Domain events
export interface PersonaCreatedEvent {
  type: 'persona:created'
  personaId: string
  name: string
}

export interface PersonaUpdatedEvent {
  type: 'persona:updated'
  personaId: string
  changes: Record<string, unknown>
}

export interface ProjectCreatedEvent {
  type: 'project:created'
  projectId: string
  path: string
  name: string
}

export interface ProjectUpdatedEvent {
  type: 'project:updated'
  projectId: string
  changes: Record<string, unknown>
}

export interface XpAwardedEvent {
  type: 'xp:awarded'
  personaId?: string
  projectId?: string
  amount: number
  eventType: string
  metadata?: Record<string, unknown>
}

export interface QuestStatusChangedEvent {
  type: 'quest:status_changed'
  questId: string
  oldStatus: string
  newStatus: string
}

export interface AchievementUnlockedEvent {
  type: 'achievement:unlocked'
  entityType: 'persona' | 'project'
  entityId: string
  achievementId: string
  name: string
  rarity: string
}

// Session events
export interface SessionStatusChangedEvent {
  type: 'session:status_changed'
  paneId: string
  personaId: string
  oldStatus: string
  newStatus: string
}

// System events
export interface ServerStartingEvent {
  type: 'server:starting'
}

export interface ServerReadyEvent {
  type: 'server:ready'
  port: number
}

export interface ServerStoppingEvent {
  type: 'server:stopping'
  reason: string
}

// Union of all events
export type AppEvent =
  | PaneDiscoveredEvent
  | PaneRemovedEvent
  | PaneChangedEvent
  | WindowCreatedEvent
  | WindowRemovedEvent
  | PreToolUseEvent
  | PostToolUseEvent
  | StopEvent
  | UserPromptEvent
  | NotificationEvent
  | PersonaCreatedEvent
  | PersonaUpdatedEvent
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | XpAwardedEvent
  | QuestStatusChangedEvent
  | AchievementUnlockedEvent
  | SessionStatusChangedEvent
  | ServerStartingEvent
  | ServerReadyEvent
  | ServerStoppingEvent

export type EventType = AppEvent['type']
