import { useState, useEffect, useCallback, useRef, memo } from 'react'

interface Toast {
  id: string
  type: 'error' | 'xp' | 'quest_xp' | 'achievement' | 'info'
  title: string
  body?: string
  timestamp: number
}

const TOAST_DURATION = 4000
const MAX_TOASTS = 5

export const ToastContainer = memo(function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const addToast = useCallback((toast: Omit<Toast, 'id' | 'timestamp'>) => {
    const id = `toast-${++counterRef.current}`
    setToasts(prev => {
      const next = [...prev, { ...toast, id, timestamp: Date.now() }]
      return next.slice(-MAX_TOASTS)
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setToasts(prev => prev.filter(t => now - t.timestamp < TOAST_DURATION))
    }, 500)
    return () => clearInterval(timer)
  }, [toasts.length])

  // Listen for pane_error events (#84)
  useEffect(() => {
    const handleError = (e: CustomEvent<{ paneId: string; message: string }>) => {
      addToast({
        type: 'error',
        title: 'Pane Error',
        body: e.detail.message,
      })
    }
    window.addEventListener('pane_error', handleError as EventListener)
    return () => window.removeEventListener('pane_error', handleError as EventListener)
  }, [addToast])

  // Listen for xp_gain events (#83)
  useEffect(() => {
    const handleXP = (e: CustomEvent<{ companionId: string; amount: number; type?: string; description?: string }>) => {
      const d = e.detail
      addToast({
        type: 'xp',
        title: `+${d.amount} XP`,
        body: d.description || d.type,
      })
    }
    window.addEventListener('xp_gain', handleXP as EventListener)
    return () => window.removeEventListener('xp_gain', handleXP as EventListener)
  }, [addToast])

  // Listen for quest_xp events (#83)
  useEffect(() => {
    const handleQuestXP = (e: CustomEvent<{ questId: string; phaseId: string; xp: number; reason: string }>) => {
      const d = e.detail
      addToast({
        type: 'quest_xp',
        title: `+${d.xp} Quest XP`,
        body: d.reason || d.phaseId,
      })
    }
    window.addEventListener('quest_xp', handleQuestXP as EventListener)
    return () => window.removeEventListener('quest_xp', handleQuestXP as EventListener)
  }, [addToast])

  // Listen for achievement_unlocked events (#37)
  useEffect(() => {
    const handleAchievement = (e: CustomEvent<{ achievementName: string; achievementIcon: string; companionName: string; rarity: string }>) => {
      const d = e.detail
      addToast({
        type: 'achievement',
        title: `${d.achievementIcon} ${d.achievementName}`,
        body: `Unlocked for ${d.companionName}`,
      })
    }
    window.addEventListener('achievement_unlocked', handleAchievement as EventListener)
    return () => window.removeEventListener('achievement_unlocked', handleAchievement as EventListener)
  }, [addToast])

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
} as const

const TOAST_ICONS = {
  error: '!',
  xp: '+',
  quest_xp: 'Q',
  achievement: '★',
  info: 'i',
} as const

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
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
}
