import { useState, useEffect, useCallback } from 'react'

interface BackendStatus {
  production: { ok: boolean; port: number }
  dev: { ok: boolean; port: number }
  activeBackend: 'production' | 'dev'
}

interface StatusPillProps {
  connected: boolean
}

export function StatusPill({ connected }: StatusPillProps) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [switching, setSwitching] = useState(false)

  const fetchStatus = useCallback(() => {
    fetch('/api/admin/backends')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setStatus(prev => {
            if (prev &&
              prev.production.ok === data.production.ok &&
              prev.dev.ok === data.dev.ok &&
              prev.activeBackend === data.activeBackend) {
              return prev
            }
            return {
              production: data.production,
              dev: data.dev,
              activeBackend: data.activeBackend,
            }
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const switchBackend = useCallback(async () => {
    if (switching || !status) return
    const target = status.activeBackend === 'production' ? 'dev' : 'production'
    if (target === 'dev' && !status.dev.ok) return

    setSwitching(true)
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: target }),
      })
      const data = await res.json()
      if (data.ok) {
        window.dispatchEvent(new CustomEvent('backend_switch', { detail: { mode: target } }))
        fetchStatus()
      }
    } catch {
      // ignore
    } finally {
      setSwitching(false)
    }
  }, [switching, status, fetchStatus])

  const isProd = status?.activeBackend === 'production'
  const devAvailable = status?.dev.ok ?? false

  // Determine dot color
  const dotClass = !connected
    ? 'bg-rpg-error animate-pulse'
    : isProd
      ? 'bg-rpg-success'
      : 'bg-orange-400'

  const dotTitle = !connected
    ? 'Disconnected'
    : isProd
      ? 'Production'
      : 'Dev backend'

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        title={dotTitle}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setExpanded(false)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Collapse"
      >
        <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
      </button>
      {status && (
        <>
          <span className="text-xs text-rpg-text-muted">
            {isProd ? 'prod' : 'dev'}:{isProd ? status.production.port : status.dev.port}
          </span>
          <button
            onClick={switchBackend}
            disabled={switching || (isProd && !devAvailable)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              switching
                ? 'opacity-50 cursor-wait'
                : isProd && !devAvailable
                  ? 'text-rpg-text-dim cursor-default'
                  : 'text-rpg-accent hover:bg-rpg-card-hover cursor-pointer'
            }`}
            title={
              isProd
                ? devAvailable ? 'Switch to dev' : 'Dev server not running'
                : 'Switch to production'
            }
          >
            {switching ? '...' : isProd ? 'use dev' : 'use prod'}
          </button>
        </>
      )}
    </div>
  )
}
