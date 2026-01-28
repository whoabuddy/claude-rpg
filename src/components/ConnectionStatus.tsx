import { useState, useEffect } from 'react'

interface ConnectionStatusProps {
  connected: boolean
}

interface ConnectionBannerProps {
  connected: boolean
  reconnectAttempt?: number
  onRetry?: () => void
}

/** Full-width banner shown when disconnected */
export function ConnectionBanner({ connected, reconnectAttempt = 0, onRetry }: ConnectionBannerProps) {
  const [disconnectedAt, setDisconnectedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!connected) {
      setDisconnectedAt(prev => prev ?? Date.now())
    } else {
      setDisconnectedAt(null)
      setElapsed(0)
    }
  }, [connected])

  useEffect(() => {
    if (!disconnectedAt) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - disconnectedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [disconnectedAt])

  if (connected) return null

  // Cap elapsed display at 60 seconds to avoid huge numbers
  const isCapped = elapsed > 60
  const displayElapsed = isCapped ? '60+' : String(elapsed)
  const attemptText = reconnectAttempt > 3 ? ` (attempt ${reconnectAttempt})` : ''
  const showRetryButton = elapsed >= 10 && onRetry

  return (
    <div className="px-4 py-2 bg-rpg-error/20 border border-rpg-error/40 rounded-lg flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-rpg-error animate-pulse flex-shrink-0" />
        <span className="text-sm text-rpg-error">
          Disconnected{elapsed > 0 ? ` ${displayElapsed}s ago` : ''} — Reconnecting{attemptText}...
        </span>
      </div>
      {showRetryButton && (
        <button
          onClick={onRetry}
          className="px-3 py-1 text-sm bg-rpg-error/30 hover:bg-rpg-error/40 text-rpg-error font-medium rounded transition-colors"
        >
          Retry Now
        </button>
      )}
    </div>
  )
}

/** Small dot indicator for header (connected state) */
export function ConnectionDot({ connected }: ConnectionStatusProps) {
  return (
    <div
      className={`w-2 h-2 rounded-full ${
        connected ? 'bg-rpg-success' : 'bg-rpg-error animate-pulse'
      }`}
      title={connected ? 'Connected' : 'Disconnected'}
    />
  )
}

/** @deprecated Use ConnectionBanner + ConnectionDot instead */
export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <ConnectionDot connected={connected} />
      <span className="text-xs text-rpg-idle">
        {connected ? 'Connected' : 'Reconnecting...'}
      </span>
    </div>
  )
}
