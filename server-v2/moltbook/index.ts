/**
 * Moltbook module - moltbook integration for claude-rpg dashboard
 *
 * Provides API endpoints and WebSocket events for moltbook activity,
 * health metrics, relationships, and orchestrator state.
 */

export {
  getMoltbookActivity,
  getMoltbookHealth,
  getMoltbookRelationships,
  getMoltbookState,
} from './api'

export {
  readActivityEvents,
  readHealthState,
  readOrchestratorState,
  readRelationships,
  getMoltbookPaths,
} from './reader'

export {
  startWatcher,
  stopWatcher,
  broadcastHealth,
} from './watcher'

export type {
  ActivityEvent,
  ActivityEventType,
  HealthState,
  OrchestratorState,
  RelationshipsData,
  Agent,
  AgentInteraction,
  MoltbookActivityResponse,
  MoltbookHealthResponse,
  MoltbookRelationshipsResponse,
  MoltbookStateResponse,
} from './types'
