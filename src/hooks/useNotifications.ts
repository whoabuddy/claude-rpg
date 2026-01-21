import { useState, useEffect, useCallback, useRef } from 'react'
import type { SessionStatus, TmuxWindow, TmuxPane } from '@shared/types'

type NotificationPermissionState = NotificationPermission | 'unsupported'

interface UseNotificationsResult {
  permission: NotificationPermissionState
  requestPermission: () => Promise<void>
  notify: (title: string, options?: NotificationOptions) => Notification | null
}

export function useNotifications(): UseNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermissionState>('default')

  // Check for Notification support and get initial permission
  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
  }, [])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return
    }

    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  const notify = useCallback((title: string, options?: NotificationOptions): Notification | null => {
    if (permission !== 'granted') {
      return null
    }

    const notification = new Notification(title, {
      icon: '/favicon.ico',
      ...options,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    return notification
  }, [permission])

  return { permission, requestPermission, notify }
}

// Track pane status changes for notifications
interface PaneTracker {
  paneId: string
  isClaudePane: boolean
  sessionName?: string
  repoName?: string
  lastStatus: SessionStatus | 'active' | 'inactive'
  command?: string
}

interface UsePaneNotificationsOptions {
  windows: TmuxWindow[]
  enabled: boolean
  notify: (title: string, options?: NotificationOptions) => Notification | null
}

export function usePaneNotifications({
  windows,
  enabled,
  notify,
}: UsePaneNotificationsOptions) {
  const trackerRef = useRef<Map<string, PaneTracker>>(new Map())

  useEffect(() => {
    if (!enabled) return

    const tracker = trackerRef.current

    // Build current pane map (all panes, not just Claude)
    const currentPanes = new Map<string, TmuxPane>()
    for (const window of windows) {
      for (const pane of window.panes) {
        currentPanes.set(pane.id, pane)
      }
    }

    // Check for status transitions
    for (const [paneId, pane] of currentPanes) {
      const isClaudePane = pane.process.type === 'claude'
      const session = pane.process.claudeSession
      const prev = tracker.get(paneId)

      if (isClaudePane && session) {
        // Claude pane tracking
        if (prev) {
          const prevStatus = prev.lastStatus as SessionStatus

          // P1: Needs attention (waiting/error)
          if (session.status === 'waiting' && prevStatus !== 'waiting') {
            const pq = session.pendingQuestion
            const question = pq ? pq.questions[pq.currentIndex]?.question : 'needs input'
            notify(`${session.name} needs input`, {
              body: `${pane.repo?.name || 'Unknown'}: ${question}`,
              tag: `pane-${paneId}`,
              requireInteraction: true,
            })
          } else if (session.status === 'error' && prevStatus !== 'error') {
            const errorInfo = session.lastError
              ? `Error in ${session.lastError.tool}`
              : 'encountered an error'
            notify(`${session.name} ${errorInfo}`, {
              body: pane.repo?.name || 'Unknown',
              tag: `pane-${paneId}`,
              requireInteraction: true,
            })
          }

          // P2: Working → Idle (task complete)
          if (session.status === 'idle' && prevStatus === 'working') {
            notify(`${session.name} finished`, {
              body: `${pane.repo?.name || 'Task'} complete`,
              tag: `pane-${paneId}-done`,
            })
          }

          tracker.set(paneId, {
            ...prev,
            lastStatus: session.status,
          })
        } else {
          // New Claude pane - just track it
          tracker.set(paneId, {
            paneId,
            isClaudePane: true,
            sessionName: session.name,
            repoName: pane.repo?.name,
            lastStatus: session.status,
          })
        }
      } else {
        // Non-Claude pane tracking
        const isActive = pane.process.typing || pane.process.type === 'process'
        const currentStatus = isActive ? 'active' : 'inactive'

        if (prev) {
          // P3: Terminal activity (inactive → active)
          if (currentStatus === 'active' && prev.lastStatus === 'inactive') {
            notify(`Activity in ${pane.process.command}`, {
              body: pane.repo?.name || pane.cwd.split('/').slice(-2).join('/'),
              tag: `pane-${paneId}-activity`,
            })
          }

          tracker.set(paneId, {
            ...prev,
            lastStatus: currentStatus,
          })
        } else {
          // New non-Claude pane - just track it
          tracker.set(paneId, {
            paneId,
            isClaudePane: false,
            repoName: pane.repo?.name,
            lastStatus: currentStatus,
            command: pane.process.command,
          })
        }
      }
    }

    // Clean up removed panes from tracker
    for (const key of tracker.keys()) {
      if (!currentPanes.has(key)) {
        tracker.delete(key)
      }
    }
  }, [windows, enabled, notify])
}
