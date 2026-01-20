import { useMemo, memo } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'
import { PaneCard } from './PaneCard'

interface OverviewDashboardProps {
  windows: TmuxWindow[]
  onSendPrompt: (paneId: string, prompt: string) => void
}

interface PaneWithWindow extends TmuxPane {
  window: TmuxWindow
}

export function OverviewDashboard({ windows, onSendPrompt }: OverviewDashboardProps) {
  // Categorize panes by status
  const { attention, working, claudeIdle, other, stats } = useMemo(() => {
    const attention: PaneWithWindow[] = []
    const working: PaneWithWindow[] = []
    const claudeIdle: PaneWithWindow[] = []
    const other: PaneWithWindow[] = []

    let totalPanes = 0
    let claudePanes = 0

    for (const window of windows) {
      for (const pane of window.panes) {
        totalPanes++
        const paneWithWindow = { ...pane, window }

        if (pane.process.type === 'claude') {
          claudePanes++
          const status = pane.process.claudeSession?.status

          if (status === 'waiting' || status === 'error') {
            attention.push(paneWithWindow)
          } else if (status === 'working') {
            working.push(paneWithWindow)
          } else {
            claudeIdle.push(paneWithWindow)
          }
        } else {
          other.push(paneWithWindow)
        }
      }
    }

    // Sort by last activity
    const sortByActivity = (a: PaneWithWindow, b: PaneWithWindow) => {
      const aTime = a.process.claudeSession?.lastActivity || 0
      const bTime = b.process.claudeSession?.lastActivity || 0
      return bTime - aTime
    }

    attention.sort(sortByActivity)
    working.sort(sortByActivity)
    claudeIdle.sort(sortByActivity)

    return {
      attention,
      working,
      claudeIdle,
      other,
      stats: { totalPanes, claudePanes, windowCount: windows.length },
    }
  }, [windows])

  const hasAnyClaude = stats.claudePanes > 0
  const needsAttention = attention.length

  return (
    <div className="p-4 space-y-6">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {stats.windowCount} Window{stats.windowCount !== 1 ? 's' : ''} / {stats.totalPanes} Pane{stats.totalPanes !== 1 ? 's' : ''}
          {needsAttention > 0 && (
            <span className="ml-2 text-rpg-waiting">
              ({needsAttention} need{needsAttention !== 1 ? '' : 's'} attention)
            </span>
          )}
        </h2>
      </div>

      {!hasAnyClaude && stats.totalPanes === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-rpg-idle">
          <p className="text-lg mb-2">No tmux panes found</p>
          <p className="text-sm text-rpg-idle/70">Start Claude Code in a tmux session to begin!</p>
        </div>
      ) : (
        <>
          {/* Needs Attention (waiting + error) */}
          {attention.length > 0 && (
            <PaneGroup
              title="Needs Attention"
              panes={attention}
              onSendPrompt={onSendPrompt}
              variant="attention"
            />
          )}

          {/* Working */}
          {working.length > 0 && (
            <PaneGroup
              title="Working"
              panes={working}
              onSendPrompt={onSendPrompt}
              variant="working"
            />
          )}

          {/* Idle Claude */}
          {claudeIdle.length > 0 && (
            <PaneGroup
              title="Idle Claude"
              panes={claudeIdle}
              onSendPrompt={onSendPrompt}
              variant="idle"
            />
          )}

          {/* Other panes (collapsed by default) */}
          {other.length > 0 && (
            <OtherPanesSection panes={other} />
          )}
        </>
      )}
    </div>
  )
}

const variantStyles = {
  attention: 'text-rpg-waiting',
  working: 'text-rpg-working',
  idle: 'text-rpg-idle',
} as const

interface PaneGroupProps {
  title: string
  panes: PaneWithWindow[]
  onSendPrompt: (paneId: string, prompt: string) => void
  variant: 'attention' | 'working' | 'idle'
}

const PaneGroup = memo(function PaneGroup({ title, panes, onSendPrompt, variant }: PaneGroupProps) {
  return (
    <div>
      <h3 className={`text-sm font-medium mb-3 ${variantStyles[variant]}`}>
        {title} ({panes.length})
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {panes.map(pane => (
          <PaneCard
            key={pane.id}
            pane={pane}
            window={pane.window}
            onSendPrompt={onSendPrompt}
          />
        ))}
      </div>
    </div>
  )
})

interface OtherPanesSectionProps {
  panes: PaneWithWindow[]
}

function OtherPanesSection({ panes }: OtherPanesSectionProps) {
  return (
    <details className="group">
      <summary className="text-sm font-medium text-rpg-idle/70 cursor-pointer hover:text-rpg-idle mb-3">
        Other Panes ({panes.length})
        <span className="ml-2 text-xs">click to expand</span>
      </summary>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {panes.map(pane => (
          <PaneCard
            key={pane.id}
            pane={pane}
            window={pane.window}
            onSendPrompt={() => {}}
            compact
          />
        ))}
      </div>
    </details>
  )
}
