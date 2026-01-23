import { useState, useEffect, useCallback, useRef } from 'react'
import type { SessionStatus, TmuxWindow, TmuxPane } from '@shared/types'

const DEFAULT_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👹</text></svg>"

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

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
      icon: DEFAULT_ICON,
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

// Maximum tracker size to prevent unbounded growth (small objects, can be larger than terminal cache)
const MAX_TRACKER_SIZE = 100

type NotifyFn = (title: string, options?: NotificationOptions) => Notification | null

// Check for Claude pane status transitions and send notifications
function checkClaudeTransitions(
  pane: TmuxPane,
  prev: PaneTracker | undefined,
  notify: NotifyFn
): PaneTracker {
  const session = pane.process.claudeSession!
  const icon = session.avatarSvg ? svgToDataUrl(session.avatarSvg) : undefined

  if (prev) {
    const prevStatus = prev.lastStatus as SessionStatus

    // Needs attention: waiting with pending question
    if (session.status === 'waiting' && prevStatus !== 'waiting' && session.pendingQuestion) {
      const question = session.pendingQuestion.questions[session.pendingQuestion.currentIndex]?.question || 'needs input'
      notify(`${session.name} needs input`, {
        body: `${pane.repo?.name || 'Unknown'}: ${question}`,
        tag: `pane-${pane.id}`,
        requireInteraction: true,
        icon,
      })
    }
    // Needs attention: error
    else if (session.status === 'error' && prevStatus !== 'error') {
      const errorInfo = session.lastError ? `Error in ${session.lastError.tool}` : 'encountered an error'
      notify(`${session.name} ${errorInfo}`, {
        body: pane.repo?.name || 'Unknown',
        tag: `pane-${pane.id}`,
        requireInteraction: true,
        icon,
      })
    }

    // Task complete: working → idle
    if (session.status === 'idle' && prevStatus === 'working') {
      notify(`${session.name} finished`, {
        body: `${pane.repo?.name || 'Task'} complete`,
        tag: `pane-${pane.id}-done`,
        icon,
      })
    }

    return { ...prev, lastStatus: session.status }
  }

  // New Claude pane
  return {
    paneId: pane.id,
    isClaudePane: true,
    sessionName: session.name,
    repoName: pane.repo?.name,
    lastStatus: session.status,
  }
}

// Check for non-Claude pane status transitions and send notifications
function checkProcessTransitions(
  pane: TmuxPane,
  prev: PaneTracker | undefined,
  notify: NotifyFn
): PaneTracker {
  const isRunningProcess = pane.process.type === 'process'
  const currentStatus = isRunningProcess ? 'active' : 'inactive'

  if (prev) {
    // Process started: inactive → active
    if (currentStatus === 'active' && prev.lastStatus === 'inactive' && isRunningProcess) {
      notify(`Running: ${pane.process.command}`, {
        body: pane.repo?.name || pane.cwd.split('/').slice(-2).join('/'),
        tag: `pane-${pane.id}-activity`,
      })
    }
    return { ...prev, lastStatus: currentStatus }
  }

  // New non-Claude pane
  return {
    paneId: pane.id,
    isClaudePane: false,
    repoName: pane.repo?.name,
    lastStatus: currentStatus,
    command: pane.process.command,
  }
}

// Enforce max tracker size by removing oldest entries
function enforceTrackerLimit(tracker: Map<string, PaneTracker>): void {
  if (tracker.size > MAX_TRACKER_SIZE) {
    const keysToDelete = Array.from(tracker.keys()).slice(0, tracker.size - MAX_TRACKER_SIZE)
    for (const key of keysToDelete) {
      tracker.delete(key)
    }
  }
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

    // Build current pane map
    const currentPanes = new Map<string, TmuxPane>()
    for (const win of windows) {
      for (const pane of win.panes) {
        currentPanes.set(pane.id, pane)
      }
    }

    // Check for status transitions
    for (const [paneId, pane] of currentPanes) {
      const prev = tracker.get(paneId)
      const isClaudePane = pane.process.type === 'claude' && pane.process.claudeSession

      const updated = isClaudePane
        ? checkClaudeTransitions(pane, prev, notify)
        : checkProcessTransitions(pane, prev, notify)

      tracker.set(paneId, updated)
    }

    // Clean up removed panes
    for (const key of tracker.keys()) {
      if (!currentPanes.has(key)) {
        tracker.delete(key)
      }
    }

    enforceTrackerLimit(tracker)

    return () => {
      trackerRef.current.clear()
    }
  }, [windows, enabled, notify])
}
