import { useState, useCallback, useEffect } from 'react'
import { WindowBar } from './components/WindowBar'
import { OverviewDashboard } from './components/OverviewDashboard'
import { WindowView } from './components/WindowView'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useWebSocket } from './hooks/useWebSocket'
import { useWindows, sendPromptToPane } from './hooks/useWindows'
import { initTerminalCache } from './hooks/usePaneTerminal'
import { useNotifications, usePaneNotifications } from './hooks/useNotifications'

type ViewMode = 'overview' | 'window'

// Initialize terminal cache once
initTerminalCache()

export default function App() {
  const { connected } = useWebSocket()
  const {
    windows,
    selectedWindowId,
    setSelectedWindowId,
    selectedWindow,
    attentionPanes,
  } = useWindows()
  const [viewMode, setViewMode] = useState<ViewMode>('overview')
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

  const handleWindowSelect = useCallback((windowId: string) => {
    setSelectedWindowId(windowId)
    setViewMode('window')
  }, [setSelectedWindowId])

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

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-rpg-border">
        <h1 className="text-lg font-bold text-rpg-accent">Claude RPG</h1>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-rpg-card rounded border border-rpg-border">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'overview'
                  ? 'bg-rpg-accent text-rpg-bg font-medium'
                  : 'text-rpg-idle hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('window')}
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'window'
                  ? 'bg-rpg-accent text-rpg-bg font-medium'
                  : 'text-rpg-idle hover:text-white'
              }`}
            >
              Window
            </button>
          </div>
          <ConnectionStatus connected={connected} />
        </div>
      </header>

      {/* Window Bar - shown in window mode or when there are multiple windows */}
      {(viewMode === 'window' || windows.length > 1) && (
        <WindowBar
          windows={windows}
          selectedId={selectedWindowId}
          onSelect={handleWindowSelect}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {viewMode === 'overview' ? (
          <OverviewDashboard
            windows={windows}
            onSendPrompt={handleSendPrompt}
          />
        ) : selectedWindow ? (
          <WindowView
            window={selectedWindow}
            onSendPrompt={handleSendPrompt}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-rpg-idle">
            <p>Select a window from the bar above</p>
          </div>
        )}
      </main>

      {/* Attention indicator - floating badge when panes need attention */}
      {viewMode !== 'overview' && attentionPanes.length > 0 && (
        <button
          onClick={() => setViewMode('overview')}
          className="fixed bottom-4 right-4 px-4 py-2 bg-rpg-waiting text-rpg-bg rounded-full shadow-lg animate-pulse hover:bg-rpg-waiting/80 transition-colors"
        >
          {attentionPanes.length} need{attentionPanes.length === 1 ? 's' : ''} attention
        </button>
      )}
    </div>
  )
}
