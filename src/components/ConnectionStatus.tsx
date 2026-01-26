import { useState, useEffect } from 'react'

interface ConnectionStatusProps {
  connected: boolean
}

/** Full-width banner shown when disconnected */
export function ConnectionBanner({ connected }: ConnectionStatusProps) {
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

  return (
    <div className="px-4 py-2 bg-rpg-error/20 border border-rpg-error/40 rounded-lg flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-rpg-error animate-pulse flex-shrink-0" />
      <span className="text-sm text-rpg-error">
        Disconnected{elapsed > 0 ? ` ${elapsed}s ago` : ''} — Reconnecting...
      </span>
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
