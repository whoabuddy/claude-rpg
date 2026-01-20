import { memo, useMemo } from 'react'
import type { TmuxWindow } from '@shared/types'

interface WindowBarProps {
  windows: TmuxWindow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Memoized window stats to avoid recalculating on every render
interface WindowStats {
  claudeCount: number
  waitingCount: number
  workingCount: number
}

function getWindowStats(window: TmuxWindow): WindowStats {
  let claudeCount = 0
  let waitingCount = 0
  let workingCount = 0

  for (const pane of window.panes) {
    if (pane.process.type === 'claude') {
      claudeCount++
      const status = pane.process.claudeSession?.status
      if (status === 'waiting') waitingCount++
      else if (status === 'working') workingCount++
    }
  }

  return { claudeCount, waitingCount, workingCount }
}

export const WindowBar = memo(function WindowBar({ windows, selectedId, onSelect }: WindowBarProps) {
  // Memoize window stats calculation
  const windowStats = useMemo(() => {
    const stats = new Map<string, WindowStats>()
    for (const window of windows) {
      stats.set(window.id, getWindowStats(window))
    }
    return stats
  }, [windows])

  if (windows.length === 0) {
    return null
  }

  return (
    <div
      className="flex items-center gap-1 px-3 py-2 bg-rpg-card border-b border-rpg-border overflow-x-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {windows.map(window => {
        const isSelected = window.id === selectedId
        const stats = windowStats.get(window.id) || { claudeCount: 0, waitingCount: 0, workingCount: 0 }

        return (
          <button
            key={window.id}
            onClick={() => onSelect(window.id)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded text-sm transition-colors whitespace-nowrap min-h-[44px] ${
              isSelected
                ? 'bg-rpg-accent text-rpg-bg font-medium'
                : 'bg-rpg-bg/50 text-rpg-idle hover:text-white hover:bg-rpg-bg'
            }`}
          >
            <span className="font-mono">{window.windowIndex}:</span>
            <span>{window.windowName}</span>

            {/* Status indicators */}
            <div className="flex items-center gap-1">
              {stats.waitingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rpg-waiting animate-pulse" title={`${stats.waitingCount} waiting`} />
              )}
              {stats.workingCount > 0 && stats.waitingCount === 0 && (
                <span className="w-2 h-2 rounded-full bg-rpg-working animate-pulse" title={`${stats.workingCount} working`} />
              )}
              {stats.claudeCount > 0 && (
                <span className="text-xs text-rpg-idle/70">({stats.claudeCount})</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
})
