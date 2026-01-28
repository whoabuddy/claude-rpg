import type { ClaudeSessionInfo } from '@shared/types'
import { STATUS_THEME } from '../constants/status'

interface WorkerCardProps {
  worker: ClaudeSessionInfo
}

export function WorkerCard({ worker }: WorkerCardProps) {
  const stats = worker.stats
  const toolsCount = stats ? Object.keys(stats.toolsUsed).length : 0
  const totalTools = stats ? Object.values(stats.toolsUsed).reduce((sum, count) => sum + count, 0) : 0

  const theme = STATUS_THEME[worker.status] || STATUS_THEME.idle

  return (
    <div className="w-40 rounded-lg border border-rpg-border bg-rpg-card overflow-hidden flex flex-col">
      {/* Avatar with name overlay */}
      <div className="relative aspect-square">
        {worker.avatarSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: worker.avatarSvg }}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-rpg-bg flex items-center justify-center text-4xl text-rpg-text-dim">
            ?
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <div className="text-sm font-medium text-white truncate">
            {worker.name}
          </div>
        </div>
      </div>

      {/* Status pill */}
      <div className="px-2 py-1.5 flex items-center justify-center">
        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${theme.bg} ${theme.text}`}>
          {worker.status}
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-2 pb-2 space-y-1 text-xs">
        <StatRow label="XP" value={stats?.totalXPGained.toLocaleString() ?? '0'} />
        <StatRow label="Tools" value={`${totalTools} (${toolsCount})`} />
        <StatRow label="Commits" value={stats?.git.commits.toLocaleString() ?? '0'} />
        <StatRow label="Tests" value={stats?.commands.testsRun.toLocaleString() ?? '0'} />
      </div>

      {/* Footer - last active */}
      <div className="px-2 py-1.5 border-t border-rpg-border bg-rpg-bg/50">
        <div className="text-[10px] text-rpg-text-dim text-center">
          {formatTimeAgo(worker.lastActivity)}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-rpg-text-dim">{label}</span>
      <span className="text-rpg-text font-medium">{value}</span>
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
