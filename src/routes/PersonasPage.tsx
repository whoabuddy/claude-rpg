import { useStore, useClaudePanes } from '../store'
import { useConnectionStatus } from '../hooks/useConnection'
import { PaneAvatar } from '../components/PaneAvatar'
import { StatusPill } from '../components/StatusPill'
import type { TmuxPane, SessionStatus } from '../../shared/types'

/**
 * Personas page - shows all Claude sessions as characters
 */
export default function PersonasPage() {
  const { connected } = useConnectionStatus()
  const claudePanes = useClaudePanes()

  // Group by status
  const activePanes = claudePanes.filter(p =>
    p.process.claudeSession?.status === 'working' ||
    p.process.claudeSession?.status === 'waiting'
  )
  const idlePanes = claudePanes.filter(p =>
    p.process.claudeSession?.status === 'idle' ||
    p.process.claudeSession?.status === 'typing'
  )

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-rpg-text">Personas</h1>
        <span className="text-sm text-rpg-text-muted">
          {claudePanes.length} active
        </span>
      </div>

      {/* Active personas */}
      {activePanes.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-rpg-text-muted mb-3">Working</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePanes.map(pane => (
              <PersonaCard key={pane.id} pane={pane} />
            ))}
          </div>
        </section>
      )}

      {/* Idle personas */}
      {idlePanes.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-rpg-text-muted mb-3">Ready</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {idlePanes.map(pane => (
              <PersonaCard key={pane.id} pane={pane} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {claudePanes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-rpg-text-dim mb-2">No active Claude sessions</p>
          <p className="text-sm text-rpg-text-muted">
            Start Claude Code in a tmux pane to see personas here
          </p>
        </div>
      )}
    </div>
  )
}

interface PersonaCardProps {
  pane: TmuxPane
}

function PersonaCard({ pane }: PersonaCardProps) {
  const session = pane.process.claudeSession
  if (!session) return null

  return (
    <div className="p-4 rounded-lg border border-rpg-border bg-rpg-card hover:border-rpg-accent/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <PaneAvatar pane={pane} size="lg" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-rpg-text truncate">{session.name}</span>
            <StatusPill status={session.status} size="sm" />
          </div>

          {/* Current activity */}
          {session.currentTool && (
            <p className="text-xs text-rpg-text-muted mt-1 truncate">
              Using {session.currentTool}
              {session.currentFile && ` on ${session.currentFile.split('/').pop()}`}
            </p>
          )}

          {/* Project */}
          {pane.repo && (
            <p className="text-xs text-rpg-text-dim mt-1 truncate">
              {pane.repo.name}
            </p>
          )}

          {/* Stats */}
          {session.stats && (
            <div className="flex gap-3 mt-2 text-xs text-rpg-text-muted">
              <span>{session.stats.totalXPGained} XP</span>
              <span>{session.stats.promptsReceived} prompts</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
