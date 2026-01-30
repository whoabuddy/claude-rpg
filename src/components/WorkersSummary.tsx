import { useMemo, useState } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'
import { STATUS_LABELS, getStatusDotClass } from '../constants/status'

interface WorkersSummaryProps {
  windows: TmuxWindow[]
  onExpandPane: (paneId: string) => void
  /** Minimum workers to show (default: 2, set to 0 to always show) */
  minWorkers?: number
  /** Whether the section is collapsible (default: true) */
  collapsible?: boolean
  /** Initial collapsed state (default: false) */
  defaultCollapsed?: boolean
}

export function WorkersSummary({
  windows,
  onExpandPane,
  minWorkers = 2,
  collapsible = true,
  defaultCollapsed = false,
}: WorkersSummaryProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  // Collect all Claude panes across windows
  const workers = useMemo(() => {
    const result: { pane: TmuxPane; windowName: string }[] = []
    for (const win of windows) {
      for (const pane of win.panes) {
        if (pane.process.type === 'claude' && pane.process.claudeSession) {
          result.push({ pane, windowName: win.windowName })
        }
      }
    }
    return result
  }, [windows])

  if (workers.length < minWorkers) return null

  return (
    <div className="rounded-lg border border-rpg-border bg-rpg-card/50 p-3">
      {collapsible ? (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 text-left hover:bg-rpg-card-hover transition-colors rounded px-1 -mx-1 py-1"
        >
          <span className="text-xs text-rpg-text-dim">
            {collapsed ? '▶' : '▼'}
          </span>
          <div className="text-xs font-medium text-rpg-text-muted">
            Active Workers ({workers.length})
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="text-xs font-medium text-rpg-text-muted">
            Active Workers ({workers.length})
          </div>
        </div>
      )}
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
          {workers.map(({ pane, windowName }) => {
            const session = pane.process.claudeSession!
            const status = session.status
            const repoLabel = pane.repo
              ? (pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name)
              : windowName

            // Activity summary
            let activity = ''
            if (session.currentTool) {
              activity = session.currentTool
              if (session.currentFile) {
                activity += `: ${session.currentFile.split('/').pop()}`
              }
            } else if (status === 'waiting') {
              activity = 'Waiting for input'
            } else if (session.lastPrompt?.trim()) {
              activity = session.lastPrompt
            }

            return (
              <button
                key={pane.id}
                onClick={() => onExpandPane(pane.id)}
                className="flex flex-col gap-1.5 px-2 py-2 rounded hover:bg-rpg-card-hover transition-colors text-left min-w-0 border border-rpg-border-dim"
              >
                {/* Header row: status dot + name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotClass(status)}`} />
                  <span className="text-sm text-rpg-text font-medium truncate">
                    {session.name}
                  </span>
                </div>

                {/* Repo */}
                <div className="text-xs text-rpg-accent truncate">
                  {repoLabel}
                </div>

                {/* Full cwd path */}
                <div className="text-xs text-rpg-text-dim font-mono truncate" title={pane.cwd}>
                  {pane.cwd}
                </div>

                {/* Activity */}
                <div className="text-xs text-rpg-text-muted truncate">
                  {activity || STATUS_LABELS[status] || 'Ready'}
                </div>

                {/* Subagent badge */}
                {(session.activeSubagents?.length || 0) > 0 && (
                  <div className="text-[10px] text-rpg-accent pt-1 border-t border-rpg-border-dim">
                    {session.activeSubagents!.length} subagent{session.activeSubagents!.length > 1 ? 's' : ''} active
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
