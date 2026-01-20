import { useState, useEffect, useCallback, useRef } from 'react'
import type { Companion, Session, SessionStatus } from '@shared/types'

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

// Track session status changes for notifications
interface SessionTracker {
  companionId: string
  companionName: string
  sessionId: string
  sessionName: string
  lastStatus: SessionStatus
}

interface UseSessionNotificationsOptions {
  companions: Companion[]
  enabled: boolean
  notify: (title: string, options?: NotificationOptions) => Notification | null
}

export function useSessionNotifications({
  companions,
  enabled,
  notify,
}: UseSessionNotificationsOptions) {
  // Track previous session statuses
  const trackerRef = useRef<Map<string, SessionTracker>>(new Map())

  useEffect(() => {
    if (!enabled) return

    const tracker = trackerRef.current

    // Build current session map
    const currentSessions = new Map<string, { session: Session; companion: Companion }>()
    for (const companion of companions) {
      for (const session of companion.state.sessions) {
        const key = `${companion.id}:${session.id}`
        currentSessions.set(key, { session, companion })
      }
    }

    // Check for status transitions
    for (const [key, { session, companion }] of currentSessions) {
      const prev = tracker.get(key)

      if (prev) {
        // Status changed - check if needs notification
        if (prev.lastStatus !== session.status) {
          // Notify on transition TO waiting or error
          if (session.status === 'waiting' && prev.lastStatus !== 'waiting') {
            const question = session.pendingQuestion?.question || 'needs input'
            notify(`${session.name} needs input`, {
              body: `${companion.repo.name}: ${question}`,
              tag: `session-${key}`,
              requireInteraction: true,
            })
          } else if (session.status === 'error' && prev.lastStatus !== 'error') {
            const errorInfo = session.lastError
              ? `Error in ${session.lastError.tool}`
              : 'encountered an error'
            notify(`${session.name} ${errorInfo}`, {
              body: companion.repo.name,
              tag: `session-${key}`,
              requireInteraction: true,
            })
          }

          // Update tracked status
          tracker.set(key, {
            ...prev,
            lastStatus: session.status,
          })
        }
      } else {
        // New session - just track it, don't notify
        tracker.set(key, {
          companionId: companion.id,
          companionName: companion.repo.name,
          sessionId: session.id,
          sessionName: session.name,
          lastStatus: session.status,
        })
      }
    }

    // Clean up removed sessions from tracker
    for (const key of tracker.keys()) {
      if (!currentSessions.has(key)) {
        tracker.delete(key)
      }
    }
  }, [companions, enabled, notify])
}
