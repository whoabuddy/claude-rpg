/**
 * WebSocket message types and priorities
 */

import type { TmuxWindow } from '../tmux/types'
import type { ClaudeSession } from '../sessions/types'
import type { Persona } from '../personas/types'
import type { Project } from '../projects/types'
import type { Quest } from '../quests/types'
import type { XpGain } from '../xp/types'
import type { Companion } from '../../shared/types'

export type MessagePriority = 'high' | 'normal' | 'low'

// Server -> Client messages

export interface ConnectedMessage {
  type: 'connected'
  sessionId: string
  timestamp: string
}

export interface WindowsMessage {
  type: 'windows'
  payload: TmuxWindow[]
}

export interface PaneUpdateMessage {
  type: 'pane_update'
  paneId: string
  session: ClaudeSession
}

export interface PaneRemovedMessage {
  type: 'pane_removed'
  paneId: string
}

export interface PersonasMessage {
  type: 'personas'
  personas: Persona[]
}

export interface PersonaUpdateMessage {
  type: 'persona_update'
  persona: Persona
}

export interface ProjectsMessage {
  type: 'projects'
  projects: Project[]
}

export interface ProjectUpdateMessage {
  type: 'project_update'
  project: Project
}

export interface QuestsMessage {
  type: 'quests'
  quests: Quest[]
}

export interface QuestUpdateMessage {
  type: 'quest_update'
  quest: Quest
}

export interface CompanionsMessage {
  type: 'companions'
  payload: Companion[]
}

export interface CompanionUpdateMessage {
  type: 'companion_update'
  companion: Companion
}

export interface XpGainMessage {
  type: 'xp_gain'
  gain: XpGain
}

export interface EventMessage {
  type: 'event'
  payload: {
    eventType: string
    paneId?: string
    timestamp: string
  }
}

export interface TerminalOutputMessage {
  type: 'terminal_output'
  payload: {
    paneId: string
    target: string
    content: string
  }
}

export interface ErrorMessage {
  type: 'error'
  code: string
  message: string
}

export type ServerMessage =
  | ConnectedMessage
  | WindowsMessage
  | PaneUpdateMessage
  | PaneRemovedMessage
  | PersonasMessage
  | PersonaUpdateMessage
  | ProjectsMessage
  | ProjectUpdateMessage
  | QuestsMessage
  | QuestUpdateMessage
  | CompanionsMessage
  | CompanionUpdateMessage
  | XpGainMessage
  | EventMessage
  | TerminalOutputMessage
  | ErrorMessage

/**
 * Get priority for a message type
 */
export function getPriority(message: ServerMessage): MessagePriority {
  switch (message.type) {
    // High priority - always send
    case 'pane_update':
    case 'pane_removed':
    case 'error':
      return 'high'

    // Normal priority - pause when buffered
    case 'connected':
    case 'windows':
    case 'personas':
    case 'persona_update':
    case 'projects':
    case 'project_update':
    case 'quests':
    case 'quest_update':
    case 'companions':
    case 'companion_update':
    case 'xp_gain':
      return 'normal'

    // Low priority - drop when buffered
    case 'event':
    case 'terminal_output':
      return 'low'

    default:
      return 'normal'
  }
}
