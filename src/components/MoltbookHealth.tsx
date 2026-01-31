import { Activity, Clock, Users, Zap, Server, AlertCircle } from 'lucide-react'
import { useMoltbookHealth, useMoltbookOrchestratorState } from '../store'
import type { HealthState } from '../types/moltbook'

const STATUS_COLORS: Record<HealthState['status'], string> = {
  ok: 'text-rpg-success',
  degraded: 'text-rpg-waiting',
  error: 'text-rpg-error',
}

const STATUS_BG: Record<HealthState['status'], string> = {
  ok: 'bg-rpg-success/10',
  degraded: 'bg-rpg-waiting/10',
  error: 'bg-rpg-error/10',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface StatCardProps {
  icon: React.FC<{ className?: string }>
  label: string
  value: string | number
  subValue?: string
  color?: string
}

function StatCard({ icon: Icon, label, value, subValue, color = 'text-rpg-text' }: StatCardProps) {
  return (
    <div className="p-3 rounded-lg bg-rpg-card border border-rpg-border/50">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-rpg-text-muted" />
        <span className="text-xs text-rpg-text-muted">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {subValue && (
        <div className="text-xs text-rpg-text-dim mt-0.5">{subValue}</div>
      )}
    </div>
  )
}

export function MoltbookHealth() {
  const health = useMoltbookHealth()
  const orchestratorState = useMoltbookOrchestratorState()

  if (!health) {
    return (
      <div className="p-4 text-center text-rpg-text-dim">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Health data not available</p>
        <p className="text-xs mt-1">Waiting for health check...</p>
      </div>
    )
  }

  const { orchestrator, agents, rate_limits, api } = health

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={`p-3 rounded-lg ${STATUS_BG[health.status]} border border-rpg-border/30`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${health.status === 'ok' ? 'bg-rpg-success' : health.status === 'degraded' ? 'bg-rpg-waiting animate-pulse' : 'bg-rpg-error animate-pulse'}`} />
            <span className={`font-medium ${STATUS_COLORS[health.status]}`}>
              {health.status.toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-rpg-text-dim">
            {formatTime(health.timestamp)}
          </span>
        </div>
        {orchestrator.last_error && (
          <div className="mt-2 flex items-start gap-2 text-xs text-rpg-error">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{orchestrator.last_error}</span>
          </div>
        )}
      </div>

      {/* Orchestrator */}
      <div>
        <h4 className="text-xs font-medium text-rpg-text-muted mb-2 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" />
          Orchestrator
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Activity}
            label="Status"
            value={orchestrator.status}
            color={orchestrator.status === 'running' ? 'text-rpg-success' : 'text-rpg-error'}
          />
          <StatCard
            icon={Clock}
            label="Uptime"
            value={formatDuration(orchestrator.uptime_seconds)}
          />
          <StatCard
            icon={Zap}
            label="Cycles"
            value={orchestrator.cycle_count}
          />
          <StatCard
            icon={Users}
            label="Running Agents"
            value={orchestratorState?.running_agents.length ?? 0}
          />
        </div>
      </div>

      {/* Agents */}
      <div>
        <h4 className="text-xs font-medium text-rpg-text-muted mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Agent Stats (Today)
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Zap}
            label="Spawned"
            value={agents.spawn_count_today}
          />
          <StatCard
            icon={Activity}
            label="Success Rate"
            value={`${Math.round(agents.success_rate * 100)}%`}
            subValue={`${agents.success_count}/${agents.success_count + agents.fail_count}`}
            color={agents.success_rate >= 0.9 ? 'text-rpg-success' : agents.success_rate >= 0.7 ? 'text-rpg-waiting' : 'text-rpg-error'}
          />
          <StatCard
            icon={Clock}
            label="Avg Duration"
            value={formatDuration(agents.avg_duration_seconds)}
          />
        </div>
      </div>

      {/* Rate Limits */}
      <div>
        <h4 className="text-xs font-medium text-rpg-text-muted mb-2 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Rate Limits
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Activity}
            label="Posts"
            value={`${rate_limits.posts_today}`}
            subValue={rate_limits.posts_remaining > 0 ? `${rate_limits.posts_remaining} remaining` : `${rate_limits.minutes_until_next_post}m until next`}
            color={rate_limits.posts_remaining > 0 ? 'text-rpg-text' : 'text-rpg-waiting'}
          />
          <StatCard
            icon={Activity}
            label="Comments"
            value={`${rate_limits.comments_today}`}
            subValue={`${rate_limits.comment_budget} budget`}
          />
        </div>
      </div>

      {/* API */}
      <div>
        <h4 className="text-xs font-medium text-rpg-text-muted mb-2 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" />
          Moltbook API
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Activity}
            label="Status"
            value={api.status}
            color={STATUS_COLORS[api.status]}
          />
          <StatCard
            icon={Clock}
            label="Response Time"
            value={`${api.response_time_ms}ms`}
            subValue={`Last: ${formatTime(api.last_check)}`}
            color={api.response_time_ms < 500 ? 'text-rpg-success' : api.response_time_ms < 1000 ? 'text-rpg-waiting' : 'text-rpg-error'}
          />
        </div>
      </div>
    </div>
  )
}
