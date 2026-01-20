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

// Track Claude pane status changes for notifications (pane-centric model)
interface PaneTracker {
  paneId: string
  sessionName: string
  repoName?: string
  lastStatus: SessionStatus
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

    // Build current Claude pane map
    const currentPanes = new Map<string, TmuxPane>()
    for (const window of windows) {
      for (const pane of window.panes) {
        if (pane.process.type === 'claude' && pane.process.claudeSession) {
          currentPanes.set(pane.id, pane)
        }
      }
    }

    // Check for status transitions
    for (const [paneId, pane] of currentPanes) {
      const session = pane.process.claudeSession!
      const prev = tracker.get(paneId)

      if (prev) {
        // Status changed - check if needs notification
        if (prev.lastStatus !== session.status) {
          if (session.status === 'waiting' && prev.lastStatus !== 'waiting') {
            const question = session.pendingQuestion?.question || 'needs input'
            notify(`${session.name} needs input`, {
              body: `${pane.repo?.name || 'Unknown'}: ${question}`,
              tag: `pane-${paneId}`,
              requireInteraction: true,
            })
          } else if (session.status === 'error' && prev.lastStatus !== 'error') {
            const errorInfo = session.lastError
              ? `Error in ${session.lastError.tool}`
              : 'encountered an error'
            notify(`${session.name} ${errorInfo}`, {
              body: pane.repo?.name || 'Unknown',
              tag: `pane-${paneId}`,
              requireInteraction: true,
            })
          }

          tracker.set(paneId, {
            ...prev,
            lastStatus: session.status,
          })
        }
      } else {
        // New pane - just track it, don't notify
        tracker.set(paneId, {
          paneId,
          sessionName: session.name,
          repoName: pane.repo?.name,
          lastStatus: session.status,
        })
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
