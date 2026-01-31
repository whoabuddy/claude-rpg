import { useEffect, useCallback, useRef, memo } from 'react'
import { useStore, type Toast } from '../store'

const TOAST_DURATION = 4000
const XP_AGGREGATION_WINDOW_MS = 2000

interface XPAggregation {
  total: number
  companionName: string
  types: Set<string>
  timer: ReturnType<typeof setTimeout>
}

export const ToastContainer = memo(function ToastContainer() {
  const toasts = useStore((state) => state.toasts)
  const addToast = useStore((state) => state.addToast)
  const removeToast = useStore((state) => state.removeToast)
  const clearExpiredToasts = useStore((state) => state.clearExpiredToasts)
  const recentXPGains = useStore((state) => state.recentXPGains)
  const xpAggregationRef = useRef<Map<string, XPAggregation>>(new Map())
  const lastXPLengthRef = useRef(0)

  // Auto-dismiss expired toasts
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setInterval(clearExpiredToasts, 500)
    return () => clearInterval(timer)
  }, [toasts.length, clearExpiredToasts])

  // Process XP gains from store with aggregation
  useEffect(() => {
    // Only process new XP gains
    if (recentXPGains.length <= lastXPLengthRef.current) {
      lastXPLengthRef.current = recentXPGains.length
      return
    }

    // Get new XP gains since last check
    const newGains = recentXPGains.slice(0, recentXPGains.length - lastXPLengthRef.current)
    lastXPLengthRef.current = recentXPGains.length

    // Helper to flush aggregation and show toast
    const flushAggregation = (companionId: string) => {
      const agg = xpAggregationRef.current.get(companionId)
      if (agg) {
        const types = Array.from(agg.types).join(', ')
        addToast({
          type: 'xp',
          title: `+${agg.total} XP`,
          body: `${agg.companionName} (${types})`,
        })
        xpAggregationRef.current.delete(companionId)
      }
    }

    // Process each new XP gain
    for (const xpGain of newGains) {
      const companionId = xpGain.companionId
      const companionName = xpGain.companionName || companionId
      const type = xpGain.type || 'XP'

      const existing = xpAggregationRef.current.get(companionId)

      if (existing) {
        // Add to existing aggregation
        existing.total += xpGain.amount
        existing.types.add(type)
        // Reset timer
        clearTimeout(existing.timer)
        existing.timer = setTimeout(() => flushAggregation(companionId), XP_AGGREGATION_WINDOW_MS)
      } else {
        // Start new aggregation
        const timer = setTimeout(() => flushAggregation(companionId), XP_AGGREGATION_WINDOW_MS)
        xpAggregationRef.current.set(companionId, {
          total: xpGain.amount,
          companionName,
          types: new Set([type]),
          timer,
        })
      }
    }

    // Cleanup on unmount
    return () => {
      xpAggregationRef.current.forEach(agg => clearTimeout(agg.timer))
    }
  }, [recentXPGains, addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-16 sm:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  )
})

const TOAST_STYLES = {
  error: 'border-rpg-error/50 bg-rpg-error/15',
  xp: 'border-rpg-accent/50 bg-rpg-accent/15',
  quest_xp: 'border-rpg-success/50 bg-rpg-success/15',
  achievement: 'border-yellow-400/50 bg-yellow-400/15',
  info: 'border-rpg-border bg-rpg-card',
  waiting: 'border-amber-400/50 bg-amber-400/15',
} as const

const TOAST_ICONS = {
  error: '!',
  xp: '+',
  quest_xp: 'Q',
  achievement: '★',
  info: 'i',
  waiting: '?',
} as const

const ToastItem = memo(function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = TOAST_STYLES[toast.type]
  const icon = TOAST_ICONS[toast.type]

  return (
    <div
      className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-lg animate-slide-in ${style}`}
      onClick={() => onDismiss(toast.id)}
    >
      <div className="flex items-center gap-2">
        <span className={`w-5 h-5 flex items-center justify-center text-xs rounded-full font-bold ${
          toast.type === 'error' ? 'bg-rpg-error/30 text-rpg-error'
            : toast.type === 'quest_xp' ? 'bg-rpg-success/30 text-rpg-success'
            : toast.type === 'achievement' ? 'bg-yellow-400/30 text-yellow-400'
            : toast.type === 'waiting' ? 'bg-amber-400/30 text-amber-400'
            : 'bg-rpg-accent/30 text-rpg-accent'
        }`}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.body && (
            <div className="text-xs text-rpg-text-muted truncate">{toast.body}</div>
          )}
        </div>
      </div>
    </div>
  )
})
