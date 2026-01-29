import { useState, useEffect, useCallback } from 'react'

interface BackendStatus {
  production: { ok: boolean; port: number }
  dev: { ok: boolean; port: number }
  activeBackend: 'production' | 'dev'
}

export function BackendSelector() {
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [switching, setSwitching] = useState(false)

  const fetchStatus = useCallback(() => {
    fetch('/api/admin/backends')
      .then(res => res.json())
      .then(response => {
        // Handle both v1 (raw) and v2 (wrapped) response formats
        const data = response.success ? response.data : response
        if (data?.ok) {
          setStatus(prev => {
            // Skip update if nothing changed
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

  const switchBackend = useCallback(async (mode: 'production' | 'dev') => {
    if (switching) return
    setSwitching(true)
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const response = await res.json()
      // Handle both v1 (raw) and v2 (wrapped) response formats
      const data = response.success ? response.data : response
      if (data?.ok) {
        // Dispatch event to trigger WebSocket reconnect
        window.dispatchEvent(new CustomEvent('backend_switch', { detail: { mode } }))
        // Refresh status
        fetchStatus()
      }
    } catch {
      // ignore
    } finally {
      setSwitching(false)
    }
  }, [switching, fetchStatus])

  if (!status) return null

  const isProd = status.activeBackend === 'production'
  const devAvailable = status.dev.ok

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => switchBackend(isProd ? 'dev' : 'production')}
        disabled={switching || (isProd && !devAvailable)}
        className={`flex items-center gap-1.5 px-2 py-0.5 text-xs rounded transition-colors ${
          switching
            ? 'opacity-50 cursor-wait'
            : isProd && !devAvailable
              ? 'cursor-default'
              : 'hover:bg-rpg-card-hover cursor-pointer'
        }`}
        title={
          isProd
            ? devAvailable
              ? 'Click to switch to dev backend'
              : 'Dev server not running'
            : 'Click to switch to production backend'
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isProd
              ? 'bg-green-500'
              : 'bg-orange-400'
          }`}
        />
        <span className="text-rpg-text-muted">
          {isProd ? 'prod' : 'dev'}:{isProd ? status.production.port : status.dev.port}
        </span>
      </button>
      {!isProd && !devAvailable && (
        <span className="text-xs text-rpg-error">offline</span>
      )}
    </div>
  )
}
