/**
 * Moltbook types for frontend
 *
 * Mirrors server-v2/moltbook/types.ts for client-side use
 */

// Activity feed event types
export type ActivityEventType =
  | 'post_created'
  | 'comment_sent'
  | 'agent_engaged'
  | 'learning_extracted'
  | 'health_check'

export interface PostCreatedData {
  id: string
  submolt: string
  title: string
}

export interface CommentSentData {
  postId: string
  commentId: string
  agent: string
}

export interface AgentEngagedData {
  agent: string
  topic: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

export interface LearningExtractedData {
  summary: string
  category: 'technical' | 'operations' | 'community'
}

export interface HealthCheckData {
  status: 'ok' | 'degraded' | 'error'
  agents: number
  total_runs: number
}

export type ActivityEventData =
  | PostCreatedData
  | CommentSentData
  | AgentEngagedData
  | LearningExtractedData
  | HealthCheckData

export interface ActivityEvent {
  type: ActivityEventType
  ts: string
  data: ActivityEventData
}

// Health metrics
export interface OrchestratorHealth {
  status: 'running' | 'stopped'
  uptime_seconds: number
  cycle_count: number
  last_error: string | null
}

export interface AgentsHealth {
  spawn_count_today: number
  success_count: number
  fail_count: number
  success_rate: number
  avg_duration_seconds: number
}

export interface RateLimitsHealth {
  posts_today: number
  posts_remaining: number
  minutes_until_next_post: number
  comments_today: number
  comment_budget: number
}

export interface ApiHealth {
  status: 'ok' | 'degraded' | 'error'
  response_time_ms: number
  last_check: string
}

export interface HealthState {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  orchestrator: OrchestratorHealth
  agents: AgentsHealth
  rate_limits: RateLimitsHealth
  api: ApiHealth
}

// Orchestrator state
export interface OrchestratorState {
  last_reply_check: number
  last_digest: number
  last_post_check: number
  last_campaign_check: number
  running_agents: string[]
  total_runs: number
}

// Agent relationships
export interface AgentInteraction {
  type: string
  date: string
  context: string
  amount?: string
  txid?: string
}

export interface Agent {
  name: string
  first_seen: string
  karma: number
  domain_overlap: string[]
  interactions: AgentInteraction[]
  has_stacks_wallet: boolean
  stacks_address?: string
  bns_name?: string
  collaboration_potential: 'high' | 'medium' | 'low'
  notes: string
}

export interface RelationshipsData {
  agents: Agent[]
  last_updated: string
  schema_version: string
}

// API response types
export interface MoltbookActivityResponse {
  events: ActivityEvent[]
  total: number
  date: string
}

export interface MoltbookHealthResponse {
  health: HealthState
}

export interface MoltbookRelationshipsResponse {
  relationships: RelationshipsData
}

export interface MoltbookStateResponse {
  state: OrchestratorState
}
