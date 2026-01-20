import { useState, useCallback } from 'react'
import { OverviewDashboard } from './components/OverviewDashboard'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useWebSocket } from './hooks/useWebSocket'
import { useWindows, sendPromptToPane } from './hooks/useWindows'
import { initTerminalCache } from './hooks/usePaneTerminal'
import { useNotifications, usePaneNotifications } from './hooks/useNotifications'

// Initialize terminal cache once
initTerminalCache()

export default function App() {
  const { connected } = useWebSocket()
  const { windows, attentionPanes } = useWindows()
  const [notificationsDismissed, setNotificationsDismissed] = useState(false)

  // Notifications
  const { permission, requestPermission, notify } = useNotifications()

  // Track pane status changes and send notifications
  usePaneNotifications({
    windows,
    enabled: permission === 'granted',
    notify,
  })

  const handleSendPrompt = useCallback(
    async (paneId: string, prompt: string) => {
      await sendPromptToPane(paneId, prompt)
    },
    []
  )

  const showNotificationBanner = permission === 'default' && !notificationsDismissed

  return (
    <div className="h-full flex flex-col bg-rpg-bg">
      {/* Notification Permission Banner */}
      {showNotificationBanner && (
        <div className="px-4 py-2 bg-rpg-waiting/20 border-b border-rpg-waiting/50 flex items-center justify-between gap-3">
          <p className="text-sm">
            Enable notifications to be alerted when Claude needs your input
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={requestPermission}
              className="px-3 py-1 text-sm bg-rpg-accent hover:bg-rpg-accent/80 text-rpg-bg rounded transition-colors"
            >
              Enable
            </button>
            <button
              onClick={() => setNotificationsDismissed(true)}
              className="px-3 py-1 text-sm text-rpg-idle hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main content - Dashboard only */}
      <main className="flex-1 overflow-y-auto">
        <OverviewDashboard
          windows={windows}
          attentionCount={attentionPanes.length}
          connected={connected}
          onSendPrompt={handleSendPrompt}
        />
      </main>
    </div>
  )
}
