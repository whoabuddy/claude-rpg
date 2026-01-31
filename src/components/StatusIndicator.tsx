import { memo, useCallback } from 'react'
import { STATUS_LABELS, STATUS_THEME } from '../constants/status'

interface StatusIndicatorProps {
  status: string
  onDismiss?: (e: React.MouseEvent) => void
  showLabel?: boolean
}

/**
 * Text-first status indicator with color-coded label.
 * The status text itself is colored, no separate dot indicator needed.
 */
export const StatusIndicator = memo(function StatusIndicator({ status, onDismiss, showLabel = true }: StatusIndicatorProps) {
  const theme = STATUS_THEME[status as keyof typeof STATUS_THEME] || STATUS_THEME.idle
  const statusLabel = STATUS_LABELS[status] || status
  const isPulsing = status === 'working' || status === 'typing' || status === 'process'

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDismiss?.(e)
  }, [onDismiss])

  return (
    <div className="flex items-center gap-1.5 ml-auto">
      {status === 'waiting' && onDismiss && (
        <button
          onClick={handleDismiss}
          className="px-1.5 py-0.5 text-xs bg-rpg-idle/30 hover:bg-rpg-idle/50 text-rpg-text-muted rounded transition-colors min-h-[28px]"
          title="Dismiss - Claude is waiting for you to type"
        >
          OK
        </button>
      )}
      {showLabel && (
        <span className={`text-xs font-medium ${theme.text} ${isPulsing ? 'animate-pulse' : ''}`}>
          {statusLabel}
        </span>
      )}
    </div>
  )
})
