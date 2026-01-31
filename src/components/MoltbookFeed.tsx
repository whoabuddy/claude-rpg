import { useMemo } from 'react'
import { MessageSquare, FileText, Users, Lightbulb, Activity } from 'lucide-react'
import { useMoltbookActivity } from '../store'
import type {
  ActivityEvent,
  ActivityEventType,
  PostCreatedData,
  CommentSentData,
  AgentEngagedData,
  LearningExtractedData,
  HealthCheckData,
} from '../types/moltbook'

const EVENT_CONFIG: Record<ActivityEventType, {
  icon: React.FC<{ className?: string }>
  color: string
  label: string
}> = {
  post_created: {
    icon: FileText,
    color: 'text-rpg-accent',
    label: 'Post Created',
  },
  comment_sent: {
    icon: MessageSquare,
    color: 'text-rpg-working',
    label: 'Comment Sent',
  },
  agent_engaged: {
    icon: Users,
    color: 'text-rpg-success',
    label: 'Agent Engaged',
  },
  learning_extracted: {
    icon: Lightbulb,
    color: 'text-rpg-xp',
    label: 'Learning Extracted',
  },
  health_check: {
    icon: Activity,
    color: 'text-rpg-text-muted',
    label: 'Health Check',
  },
}

function formatEventData(event: ActivityEvent): string {
  switch (event.type) {
    case 'post_created': {
      const data = event.data as PostCreatedData
      return `"${data.title}" in m/${data.submolt}`
    }
    case 'comment_sent': {
      const data = event.data as CommentSentData
      return `Replied to ${data.agent}`
    }
    case 'agent_engaged': {
      const data = event.data as AgentEngagedData
      return `${data.agent} (${data.topic}, ${data.sentiment})`
    }
    case 'learning_extracted': {
      const data = event.data as LearningExtractedData
      return `${data.category}: ${data.summary}`
    }
    case 'health_check': {
      const data = event.data as HealthCheckData
      return `${data.status} - ${data.agents} agents, ${data.total_runs} runs`
    }
    default:
      return JSON.stringify(event.data)
  }
}

function formatTime(ts: string): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return date.toLocaleDateString()
}

interface ActivityItemProps {
  event: ActivityEvent
}

function ActivityItem({ event }: ActivityItemProps) {
  const config = EVENT_CONFIG[event.type]
  const Icon = config.icon

  return (
    <div className="flex items-start gap-3 py-2 border-b border-rpg-border/50 last:border-b-0">
      <div className={`flex-shrink-0 p-1.5 rounded-lg bg-rpg-card ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-rpg-text">{config.label}</span>
          <span className="text-xs text-rpg-text-dim">{formatTime(event.ts)}</span>
        </div>
        <p className="text-sm text-rpg-text-muted truncate">
          {formatEventData(event)}
        </p>
      </div>
    </div>
  )
}

interface MoltbookFeedProps {
  maxItems?: number
}

export function MoltbookFeed({ maxItems = 20 }: MoltbookFeedProps) {
  const activity = useMoltbookActivity()

  const displayedActivity = useMemo(() =>
    activity.slice(0, maxItems),
    [activity, maxItems]
  )

  if (displayedActivity.length === 0) {
    return (
      <div className="p-4 text-center text-rpg-text-dim">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs mt-1">Activity will appear here as events occur</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-rpg-border/30">
      {displayedActivity.map((event, index) => (
        <ActivityItem key={`${event.ts}-${index}`} event={event} />
      ))}
    </div>
  )
}
