import { PaneAvatar } from './PaneAvatar'
import type { TmuxPane, SessionStatus } from '../../shared/types'

interface WorkerPillProps {
  pane: TmuxPane
}

export function WorkerPill({ pane }: WorkerPillProps) {
  const session = pane.process.claudeSession
  if (!session) return null

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rpg-card border border-rpg-border rounded-full text-sm hover:border-rpg-accent/50 transition-colors">
      <PaneAvatar pane={pane} size="sm" />
      <span className="font-medium text-rpg-text">{session.name}</span>
      <StatusDot status={session.status} />
      {pane.repo && (
        <span className="text-rpg-text-dim text-xs">{pane.repo.name}</span>
      )}
    </div>
  )
}

interface StatusDotProps {
  status: SessionStatus
}

function StatusDot({ status }: StatusDotProps) {
  const dotClass = {
    idle: 'bg-rpg-success',
    typing: 'bg-blue-400',
    working: 'bg-yellow-400 animate-pulse',
    waiting: 'bg-orange-400 animate-pulse',
    error: 'bg-rpg-error animate-pulse',
  }[status]

  const title = {
    idle: 'Ready',
    typing: 'Active',
    working: 'Working',
    waiting: 'Waiting for input',
    error: 'Error',
  }[status]

  return (
    <div
      className={`w-2 h-2 rounded-full ${dotClass}`}
      title={title}
    />
  )
}
