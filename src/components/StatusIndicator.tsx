import { memo, useCallback } from 'react'
import { STATUS_LABELS, STATUS_THEME } from '../constants/status'

interface StatusIndicatorProps {
  status: string
  onDismiss?: (e: React.MouseEvent) => void
  showLabel?: boolean
}

/**
 * Game-UI inspired status badge.
 * Large enough to tap, color-coded background, clear text.
 * Like a buff/debuff icon in WoW.
 */
export const StatusIndicator = memo(function StatusIndicator({ status, onDismiss, showLabel = true }: StatusIndicatorProps) {
  const theme = STATUS_THEME[status as keyof typeof STATUS_THEME] || STATUS_THEME.idle
  const statusLabel = STATUS_LABELS[status] || status
  const isPulsing = status === 'working' || status === 'typing' || status === 'process'
  const needsAction = status === 'waiting' || status === 'error'

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDismiss?.(e)
  }, [onDismiss])

  // Waiting status with dismiss action - larger interactive target
  if (status === 'waiting' && onDismiss) {
    return (
      <button
        onClick={handleDismiss}
        className={`px-3 py-2 rounded-lg text-sm font-semibold ${theme.bg} ${theme.text} ${theme.glow} min-w-[72px] min-h-[40px] active:scale-95 transition-all`}
        title="Tap to dismiss"
      >
        {statusLabel}
      </button>
    )
  }

  // Standard status badge
  if (!showLabel) return null

  return (
    <div
      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${theme.bg} ${theme.text} ${
        needsAction ? theme.glow : ''
      } ${isPulsing ? 'animate-pulse' : ''} min-w-[60px] text-center`}
    >
      {statusLabel}
    </div>
  )
})
