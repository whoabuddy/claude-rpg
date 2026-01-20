import { memo } from 'react'
import type { TmuxWindow } from '@shared/types'

interface WindowBarProps {
  windows: TmuxWindow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export const WindowBar = memo(function WindowBar({ windows, selectedId, onSelect }: WindowBarProps) {
  if (windows.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-rpg-card border-b border-rpg-border overflow-x-auto">
      {windows.map(window => {
        const isSelected = window.id === selectedId
        const claudePanes = window.panes.filter(p => p.process.type === 'claude')
        const waitingPanes = claudePanes.filter(p => p.process.claudeSession?.status === 'waiting')
        const workingPanes = claudePanes.filter(p => p.process.claudeSession?.status === 'working')

        return (
          <button
            key={window.id}
            onClick={() => onSelect(window.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
              isSelected
                ? 'bg-rpg-accent text-rpg-bg font-medium'
                : 'bg-rpg-bg/50 text-rpg-idle hover:text-white hover:bg-rpg-bg'
            }`}
          >
            <span className="font-mono">{window.windowIndex}:</span>
            <span>{window.windowName}</span>

            {/* Status indicators */}
            <div className="flex items-center gap-1">
              {waitingPanes.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rpg-waiting animate-pulse" title={`${waitingPanes.length} waiting`} />
              )}
              {workingPanes.length > 0 && !waitingPanes.length && (
                <span className="w-2 h-2 rounded-full bg-rpg-working animate-pulse" title={`${workingPanes.length} working`} />
              )}
              {claudePanes.length > 0 && (
                <span className="text-xs text-rpg-idle/70">({claudePanes.length})</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
})
