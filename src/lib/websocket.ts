/**
 * WebSocket client that updates Zustand store directly.
 * Replaces CustomEvent-based pub/sub with direct store updates.
 */

import { useStore } from '../store'
import type { ServerMessage } from '../../shared/types'
import type { ActivityEvent, HealthState } from '../types/moltbook'
import { playSoundIfEnabled } from './sounds'

// Extended message types for moltbook
interface MoltbookActivityMessage {
  type: 'moltbook_activity'
  payload: ActivityEvent
}

interface MoltbookHealthMessage {
  type: 'moltbook_health'
  payload: HealthState
}

type ExtendedServerMessage = ServerMessage | MoltbookActivityMessage | MoltbookHealthMessage

// Use relative WebSocket URL to go through Vite proxy
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws`

// Backoff constants
const MIN_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const SLEEP_DETECTION_THRESHOLD = 5000

// Module state
let ws: WebSocket | null = null
let reconnectTimeout: number | undefined
let lastActivityTime = Date.now()
let scheduledReconnectTime = 0
let reconnectAttemptCount = 0

// Track pane statuses to detect transitions to 'waiting'
const paneStatuses = new Map<string, string>()

/**
 * Check if a pane status transitioned to 'waiting' and fire toast if so
 */
function checkWaitingTransition(
  paneId: string,
  newStatus: string | undefined,
  paneName: string | undefined,
  store: ReturnType<typeof useStore.getState>
): void {
  if (!newStatus) return

  const oldStatus = paneStatuses.get(paneId)
  paneStatuses.set(paneId, newStatus)

  // Fire toast when transitioning TO waiting (not already waiting)
  // Note: Discord notification sent from useNotifications with more context
  if (newStatus === 'waiting' && oldStatus !== 'waiting') {
    store.addToast({
      type: 'waiting',
      title: 'Input Needed',
      body: paneName ? `${paneName} is waiting for you` : `Pane is waiting for input`,
    })
    playSoundIfEnabled('waiting')
  }
}

/**
 * Clean up WebSocket handlers and close connection
 */
function cleanup(): void {
  if (!ws) return
  ws.onopen = null
  ws.onmessage = null
  ws.onclose = null
  ws.onerror = null
  if (ws.readyState !== WebSocket.CLOSED) {
    ws.close()
  }
  ws = null
}

/**
 * Clear pending reconnect timeout
 */
function clearReconnect(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = undefined
  }
  reconnectAttemptCount = 0
  useStore.getState().setReconnectAttempt(0)
}

/**
 * Handle incoming WebSocket message - update store directly
 */
function handleMessage(event: MessageEvent): void {
  try {
    const message = JSON.parse(event.data) as ExtendedServerMessage
    const store = useStore.getState()

    switch (message.type) {
      // Connection
      case 'connected':
        // Server acknowledged connection
        break

      // Pane-centric messages
      case 'windows': {
        // Check for waiting transitions before updating store
        const windows = message.payload as Array<{ panes: Array<{ id: string; process: { claudeSession?: { status: string; name: string } } }> }>
        for (const window of windows) {
          for (const pane of window.panes) {
            const session = pane.process.claudeSession
            if (session) {
              checkWaitingTransition(pane.id, session.status, session.name, store)
            }
          }
        }
        store.setWindows(message.payload)
        break
      }

      case 'pane_update': {
        // Check for waiting transition on single pane update
        const pane = message.payload as { id: string; process: { claudeSession?: { status: string; name: string } } }
        const session = pane.process.claudeSession
        if (session) {
          checkWaitingTransition(pane.id, session.status, session.name, store)
        }
        store.updatePane(message.payload)
        break
      }

      case 'pane_removed':
        paneStatuses.delete(message.payload.paneId)  // Clean up status tracking
        store.removePane(message.payload.paneId)
        break

      // Terminal content
      case 'terminal_output':
        store.setTerminalContent(message.payload.paneId, message.payload.content)
        break

      // Companion messages
      case 'companions':
        store.setCompanions(message.payload)
        break

      case 'companion_update':
        store.updateCompanion(message.payload)
        break

      // XP
      case 'xp_gain':
        store.addXPGain(message.payload)
        break

      // Quest messages
      case 'quests_init':
        store.setQuests(message.payload)
        break

      case 'quest_update':
        store.updateQuest(message.payload)
        break

      // Workers
      case 'workers_init':
        store.setWorkers(message.payload)
        break

      // Events
      case 'event': {
        const event = message.payload
        store.addEvent(event)

        // Record pane activity for visual pulse
        if (event.paneId) {
          const activityType = event.type.includes('tool') ? 'tool'
            : event.type === 'user_prompt_submit' ? 'prompt'
            : event.type === 'stop' ? 'stop'
            : event.type.includes('error') ? 'error'
            : 'tool'
          store.recordPaneActivity(event.paneId, activityType)
        }
        break
      }

      case 'history':
        store.setEventHistory(message.payload)
        break

      // Achievement unlocked - add toast with sound
      case 'achievement_unlocked': {
        const ach = message.payload as { achievementName: string; achievementIcon: string; companionName: string }
        store.addToast({
          type: 'achievement',
          title: `${ach.achievementIcon} ${ach.achievementName}`,
          body: `Unlocked for ${ach.companionName}`,
        })
        playSoundIfEnabled('achievement')
        break
      }

      // Pane error - add toast with sound
      case 'pane_error': {
        const err = message.payload as { message: string }
        store.addToast({
          type: 'error',
          title: 'Pane Error',
          body: err.message,
        })
        playSoundIfEnabled('error')
        break
      }

      // Quest XP - add toast
      case 'quest_xp': {
        const qxp = message.payload as { xp: number; reason: string; phaseId: string }
        store.addToast({
          type: 'quest_xp',
          title: `+${qxp.xp} Quest XP`,
          body: qxp.reason || qxp.phaseId,
        })
        break
      }

      // Moltbook activity event
      case 'moltbook_activity':
        store.addMoltbookActivity(message.payload)
        break

      // Moltbook health update
      case 'moltbook_health':
        store.setMoltbookHealth(message.payload)
        break
    }
  } catch (e) {
    console.error('[claude-rpg] Error parsing message:', e)
  }
}

/**
 * Connect to WebSocket server
 */
export function connect(): void {
  if (ws?.readyState === WebSocket.OPEN) return

  cleanup()
  useStore.getState().setConnectionStatus('connecting')

  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    console.log('[claude-rpg] Connected to server')
    useStore.getState().setConnectionStatus('connected')
    reconnectAttemptCount = 0
    lastActivityTime = Date.now()
  }

  ws.onmessage = handleMessage

  ws.onclose = () => {
    console.log('[claude-rpg] Disconnected from server')
    useStore.getState().setConnectionStatus('disconnected')

    // Calculate exponential backoff with jitter
    reconnectAttemptCount++
    const baseDelay = Math.min(
      MIN_RECONNECT_DELAY * Math.pow(2, reconnectAttemptCount - 1),
      MAX_RECONNECT_DELAY
    )
    const jitter = baseDelay * 0.1 * Math.random()
    const delay = baseDelay + jitter

    lastActivityTime = Date.now()
    scheduledReconnectTime = delay
    useStore.getState().setReconnectAttempt(reconnectAttemptCount)

    reconnectTimeout = window.setTimeout(() => {
      const elapsed = Date.now() - lastActivityTime

      // If elapsed >> scheduled, device likely slept - reset backoff
      if (elapsed > scheduledReconnectTime + SLEEP_DETECTION_THRESHOLD) {
        console.log('[claude-rpg] Sleep detected, resetting backoff')
        reconnectAttemptCount = 0
        useStore.getState().setReconnectAttempt(0)
      }
      connect()
    }, delay)
  }

  ws.onerror = (error) => {
    console.error('[claude-rpg] WebSocket error:', error)
  }
}

/**
 * Force immediate reconnection (for manual retry)
 */
export function forceReconnect(): void {
  console.log('[claude-rpg] Manual reconnect requested')
  clearReconnect()
  cleanup()
  connect()
}

/**
 * Disconnect and clean up
 */
export function disconnect(): void {
  clearReconnect()
  cleanup()
  useStore.getState().setConnectionStatus('disconnected')
}

/**
 * Initialize WebSocket with event listeners
 */
export function initWebSocket(): () => void {
  connect()

  // Listen for backend switch events
  const handleBackendSwitch = () => {
    console.log('[claude-rpg] Backend switched, reconnecting...')
    clearReconnect()
    cleanup()
    setTimeout(connect, 500)
  }
  window.addEventListener('backend_switch', handleBackendSwitch)

  // Reconnect when tab becomes visible
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && ws?.readyState !== WebSocket.OPEN) {
      console.log('[claude-rpg] Tab visible, reconnecting...')
      clearReconnect()
      connect()
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Handle network online/offline
  const handleOnline = () => {
    console.log('[claude-rpg] Network online, reconnecting...')
    clearReconnect()
    connect()
  }
  const handleOffline = () => {
    console.log('[claude-rpg] Network offline')
    clearReconnect()
  }
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Return cleanup function
  return () => {
    window.removeEventListener('backend_switch', handleBackendSwitch)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    disconnect()
  }
}
