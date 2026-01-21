import { useMemo } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'
import { PaneCard } from './PaneCard'
import { ConnectionStatus } from './ConnectionStatus'

interface OverviewDashboardProps {
  windows: TmuxWindow[]
  attentionCount: number
  connected: boolean
  proMode: boolean
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  onToggleProMode: () => void
}

interface PaneWithWindow extends TmuxPane {
  window: TmuxWindow
  sortPriority: number
}

export function OverviewDashboard({
  windows,
  attentionCount,
  connected,
  proMode,
  onSendPrompt,
  onSendSignal,
  onToggleProMode,
}: OverviewDashboardProps) {
  // Flatten all panes - stable order by window/pane position (no dynamic sorting)
  const { panes, stats } = useMemo(() => {
    const allPanes: PaneWithWindow[] = []
    let claudeCount = 0
    let windowIndex = 0

    for (const window of windows) {
      for (const pane of window.panes) {
        if (pane.process.type === 'claude') claudeCount++
        allPanes.push({
          ...pane,
          window,
          // Use window order + pane index for stable ordering
          sortPriority: windowIndex * 100 + pane.paneIndex,
        })
      }
      windowIndex++
    }

    // Stable sort by window/pane position - no layout shift on status changes
    allPanes.sort((a, b) => a.sortPriority - b.sortPriority)

    return {
      panes: allPanes,
      stats: {
        total: allPanes.length,
        claude: claudeCount,
        windows: windows.length,
      },
    }
  }, [windows])

  return (
    <div className="p-4 space-y-4">
      {/* Header: stats left, pro toggle + connection right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-rpg-idle">
            {stats.windows} Window{stats.windows !== 1 ? 's' : ''} / {stats.total} Pane{stats.total !== 1 ? 's' : ''}
          </span>
          {attentionCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-rpg-waiting/20 text-rpg-waiting text-xs font-medium animate-pulse">
              {attentionCount} need{attentionCount !== 1 ? '' : 's'} attention
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleProMode}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              proMode
                ? 'bg-rpg-accent/20 text-rpg-accent'
                : 'bg-rpg-card text-rpg-idle hover:text-white'
            }`}
            title={proMode ? "Show Bitcoin faces" : "Hide Bitcoin faces"}
          >
            {proMode ? 'Pro' : '😎'}
          </button>
          <ConnectionStatus connected={connected} />
        </div>
      </div>

      {/* Pane list */}
      {panes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-rpg-idle">
          <p className="text-lg mb-2">No tmux panes found</p>
          <p className="text-sm text-rpg-idle/70">Start Claude Code in a tmux session to begin!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {panes.map(pane => (
            <PaneCard
              key={pane.id}
              pane={pane}
              window={pane.window}
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
              proMode={proMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
