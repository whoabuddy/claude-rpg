import { useState, useCallback, useMemo, useEffect } from 'react'
import { OverviewDashboard } from './components/OverviewDashboard'
import { FullScreenPane } from './components/FullScreenPane'
import { CompetitionsPage } from './components/CompetitionsPage'
import { QuestsPage } from './components/QuestsPage'
import { useWebSocket } from './hooks/useWebSocket'
import { useWindows, sendPromptToPane, sendSignalToPane, dismissWaiting, refreshPane, closePane, createPaneInWindow, createClaudeInWindow, createWindow, renameWindow } from './hooks/useWindows'
import { initTerminalCache } from './hooks/usePaneTerminal'
import { useNotifications, usePaneNotifications } from './hooks/useNotifications'
import { PaneActionsProvider, type PaneActionsContextValue } from './contexts/PaneActionsContext'

type ViewTab = 'dashboard' | 'quests' | 'competitions'

export default function App() {
  const { connected } = useWebSocket()
  const { windows, attentionPanes } = useWindows()
  const [notificationsDismissed, setNotificationsDismissed] = useState(false)
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard')
  const [rpgEnabled, setRpgEnabled] = useState(true)
  const [activeBackend, setActiveBackend] = useState<'production' | 'dev'>('production')

  // Initialize terminal cache with proper cleanup
  useEffect(() => {
    const cleanup = initTerminalCache()
    return cleanup
  }, [])

  // Fetch feature flags and active backend from server
  useEffect(() => {
    fetch('/health')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          if (data.rpgFeatures !== undefined) setRpgEnabled(data.rpgFeatures)
          if (data.activeBackend) setActiveBackend(data.activeBackend)
        }
      })
      .catch(() => {})
  }, [])

  // Notifications
  const { permission, requestPermission, notify } = useNotifications()

  // Track pane status changes and send notifications
  usePaneNotifications({
    windows,
    enabled: permission === 'granted',
    notify,
  })

  // Pane action handlers — module-level functions are stable references, no useCallback needed
  const handleCreateWindow = useCallback(
    async (sessionName: string, windowName: string): Promise<boolean> => {
      const result = await createWindow(sessionName, windowName)
      return result.ok
    },
    []
  )

  // Navigation handlers
  const handleExpandPane = useCallback((paneId: string) => setFullscreenPaneId(paneId), [])
  const handleCloseFullscreen = useCallback(() => setFullscreenPaneId(null), [])
  const handleNavigateToCompetitions = useCallback(() => setActiveTab('competitions'), [])
  const handleNavigateToQuests = useCallback(() => setActiveTab('quests'), [])
  const handleNavigateToDashboard = useCallback(() => setActiveTab('dashboard'), [])

  // PaneActionsContext value — module-level functions are stable, only handleExpandPane and rpgEnabled change
  const paneActions = useMemo<PaneActionsContextValue>(() => ({
    onSendPrompt: sendPromptToPane,
    onSendSignal: sendSignalToPane,
    onDismissWaiting: dismissWaiting,
    onExpandPane: handleExpandPane,
    onRefreshPane: refreshPane,
    onClosePane: closePane,
    rpgEnabled,
  }), [handleExpandPane, rpgEnabled])

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
    <PaneActionsProvider value={paneActions}>
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
          {activeTab === 'competitions' && rpgEnabled ? (
            <CompetitionsPage
              connected={connected}
              onNavigateBack={handleNavigateToDashboard}
            />
          ) : activeTab === 'quests' && rpgEnabled ? (
            <QuestsPage
              connected={connected}
              onNavigateBack={handleNavigateToDashboard}
            />
          ) : (
            <OverviewDashboard
              windows={windows}
              attentionCount={attentionPanes.length}
              connected={connected}
              onNewPane={createPaneInWindow}
              onNewClaude={createClaudeInWindow}
              onCreateWindow={handleCreateWindow}
              onRenameWindow={renameWindow}
              onNavigateToCompetitions={handleNavigateToCompetitions}
              onNavigateToQuests={handleNavigateToQuests}
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
          />
        )}
      </div>
    </PaneActionsProvider>
  )
}
