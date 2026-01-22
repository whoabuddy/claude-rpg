import { useState, useCallback, useMemo } from 'react'
import { OverviewDashboard } from './components/OverviewDashboard'
import { FullScreenPane } from './components/FullScreenPane'
import { CompetitionsPage } from './components/CompetitionsPage'
import { useWebSocket } from './hooks/useWebSocket'
import { useWindows, sendPromptToPane, sendSignalToPane, dismissWaiting, refreshPane, closePane, createPaneInWindow, createClaudeInWindow } from './hooks/useWindows'
import { initTerminalCache } from './hooks/usePaneTerminal'
import { useNotifications, usePaneNotifications } from './hooks/useNotifications'

type ViewTab = 'dashboard' | 'competitions'

// Initialize terminal cache once
initTerminalCache()

export default function App() {
  const { connected } = useWebSocket()
  const { windows, attentionPanes } = useWindows()
  const [notificationsDismissed, setNotificationsDismissed] = useState(false)
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard')
  const [proMode, setProMode] = useState(() => {
    // Persist pro mode preference
    return localStorage.getItem('claude-rpg-pro-mode') === 'true'
  })

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

  const handleSendSignal = useCallback(
    async (paneId: string, signal: string) => {
      await sendSignalToPane(paneId, signal)
    },
    []
  )

  const handleDismissWaiting = useCallback(
    async (paneId: string) => {
      await dismissWaiting(paneId)
    },
    []
  )

  const handleRefreshPane = useCallback(
    async (paneId: string) => {
      await refreshPane(paneId)
    },
    []
  )

  const handleClosePane = useCallback(
    async (paneId: string) => {
      await closePane(paneId)
    },
    []
  )

  const handleNewPane = useCallback(
    async (windowId: string) => {
      await createPaneInWindow(windowId)
    },
    []
  )

  const handleNewClaude = useCallback(
    async (windowId: string) => {
      await createClaudeInWindow(windowId)
    },
    []
  )

  const handleToggleProMode = useCallback(() => {
    setProMode(prev => {
      const next = !prev
      localStorage.setItem('claude-rpg-pro-mode', String(next))
      return next
    })
  }, [])

  const handleExpandPane = useCallback((paneId: string) => {
    setFullscreenPaneId(paneId)
  }, [])

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenPaneId(null)
  }, [])

  const handleNavigateToCompetitions = useCallback(() => {
    setActiveTab('competitions')
  }, [])

  const handleNavigateToDashboard = useCallback(() => {
    setActiveTab('dashboard')
  }, [])

  // Find the fullscreen pane and its window
  const fullscreenData = useMemo(() => {
    if (!fullscreenPaneId) return null
    for (const window of windows) {
      const pane = window.panes.find(p => p.id === fullscreenPaneId)
      if (pane) return { pane, window }
    }
    return null
  }, [fullscreenPaneId, windows])

  // Count attention panes excluding the fullscreen one
  const otherAttentionCount = useMemo(() => {
    if (!fullscreenPaneId) return 0
    return attentionPanes.filter(p => p.id !== fullscreenPaneId).length
  }, [attentionPanes, fullscreenPaneId])

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
              className="px-3 py-1 text-sm bg-rpg-accent hover:bg-rpg-accent-dim text-rpg-bg font-medium rounded transition-colors"
            >
              Enable
            </button>
            <button
              onClick={() => setNotificationsDismissed(true)}
              className="px-3 py-1 text-sm text-rpg-idle hover:text-rpg-text transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' ? (
          <OverviewDashboard
            windows={windows}
            attentionCount={attentionPanes.length}
            connected={connected}
            proMode={proMode}
            onSendPrompt={handleSendPrompt}
            onSendSignal={handleSendSignal}
            onDismissWaiting={handleDismissWaiting}
            onExpandPane={handleExpandPane}
            onRefreshPane={handleRefreshPane}
            onClosePane={handleClosePane}
            onNewPane={handleNewPane}
            onNewClaude={handleNewClaude}
            onToggleProMode={handleToggleProMode}
            onNavigateToCompetitions={handleNavigateToCompetitions}
          />
        ) : (
          <CompetitionsPage
            connected={connected}
            onNavigateBack={handleNavigateToDashboard}
          />
        )}
      </main>

      {/* Full-screen pane overlay */}
      {fullscreenData && (
        <FullScreenPane
          pane={fullscreenData.pane}
          window={fullscreenData.window}
          attentionCount={otherAttentionCount}
          onClose={handleCloseFullscreen}
          onSendPrompt={handleSendPrompt}
          onSendSignal={handleSendSignal}
          onDismissWaiting={handleDismissWaiting}
          onClosePane={handleClosePane}
          proMode={proMode}
        />
      )}
    </div>
  )
}
