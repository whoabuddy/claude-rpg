import { memo } from 'react'
import { PaneAvatar } from './PaneAvatar'
import { STATUS_LABELS, getStatusDotClass } from '../constants/status'
import type { TmuxPane, SessionStatus } from '../../shared/types'

interface WorkerPillProps {
  pane: TmuxPane
  onClick?: () => void
}

export const WorkerPill = memo(function WorkerPill({ pane, onClick }: WorkerPillProps) {
  const session = pane.process.claudeSession
  if (!session) return null

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-rpg-card border border-rpg-border rounded-full text-sm transition-colors ${
        onClick ? 'cursor-pointer hover:border-rpg-accent hover:bg-rpg-card/80' : 'hover:border-rpg-accent/50'
      }`}
    >
      <PaneAvatar pane={pane} size="sm" />
      <span className="font-medium text-rpg-text">{session.name}</span>
      <StatusDot status={session.status} />
      {pane.repo && (
        <span className="text-rpg-text-dim text-xs">{pane.repo.name}</span>
      )}
    </Component>
  )
})

interface StatusDotProps {
  status: SessionStatus
}

function StatusDot({ status }: StatusDotProps) {
  return (
    <div
      className={`w-2 h-2 rounded-full ${getStatusDotClass(status)}`}
      title={STATUS_LABELS[status] || status}
    />
  )
}
