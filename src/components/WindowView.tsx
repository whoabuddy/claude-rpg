import { memo } from 'react'
import type { TmuxWindow } from '@shared/types'
import { PaneCard } from './PaneCard'

interface WindowViewProps {
  window: TmuxWindow
  onSendPrompt: (paneId: string, prompt: string) => void
}

export const WindowView = memo(function WindowView({ window, onSendPrompt }: WindowViewProps) {
  const claudePanes = window.panes.filter(p => p.process.type === 'claude')
  const otherPanes = window.panes.filter(p => p.process.type !== 'claude')

  return (
    <div className="p-4 space-y-6">
      {/* Window header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          <span className="font-mono text-rpg-accent">{window.windowIndex}:</span>
          {window.windowName}
        </h2>
        <span className="text-sm text-rpg-idle">
          {window.panes.length} pane{window.panes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Claude panes */}
      {claudePanes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-rpg-accent mb-3">
            Claude Sessions ({claudePanes.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {claudePanes.map(pane => (
              <PaneCard
                key={pane.id}
                pane={pane}
                window={window}
                onSendPrompt={onSendPrompt}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other panes */}
      {otherPanes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-rpg-idle/70 mb-3">
            Other Panes ({otherPanes.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {otherPanes.map(pane => (
              <PaneCard
                key={pane.id}
                pane={pane}
                window={window}
                onSendPrompt={() => {}}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {window.panes.length === 0 && (
        <div className="flex items-center justify-center py-12 text-rpg-idle">
          <p>No panes in this window</p>
        </div>
      )}
    </div>
  )
})
