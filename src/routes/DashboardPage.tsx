import { useMemo, useState, useCallback } from 'react'
import { useStore } from '../store'
import { useConnectionStatus } from '../hooks/useConnection'
import { useNotifications, usePaneNotifications } from '../hooks/useNotifications'
import { PaneActionsProvider, type PaneActionsContextValue } from '../contexts/PaneActionsContext'
import { OverviewDashboard } from '../components/OverviewDashboard'
import { FullScreenPane } from '../components/FullScreenPane'
import { SlidePanel } from '../components/SlidePanel'
import { QuestsPanel } from '../components/QuestsPanel'
import { ScratchpadPanel } from '../components/ScratchpadPanel'
import {
  sendPromptToPane,
  sendSignalToPane,
  dismissWaiting,
  refreshPane,
  closePane,
  createPaneInWindow,
  createWindow,
  renameWindow,
} from '../lib/api'

export default function DashboardPage() {
  const { connected, reconnectAttempt, forceReconnect } = useConnectionStatus()

  const windows = useStore((state) => state.windows)
  // Derive attentionPanes from windows using useMemo to avoid infinite loop
  // (selectors that return new arrays cause React 18's useSyncExternalStore to loop)
  const attentionPanes = useMemo(() =>
    windows.flatMap(w => w.panes).filter(p =>
      p.process.type === 'claude' &&
      (p.process.claudeSession?.status === 'waiting' || p.process.claudeSession?.status === 'error')
    ),
    [windows]
  )

  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null)
  const [rpgEnabled] = useState(true)

  // Panel visibility state
  const [questsPanelOpen, setQuestsPanelOpen] = useState(false)
  const [scratchpadPanelOpen, setScratchpadPanelOpen] = useState(false)

  // Notifications
  const { permission, notify } = useNotifications()
  usePaneNotifications({
    windows,
    enabled: permission === 'granted',
    notify,
  })

  // Pane action handlers
  const handleCreateWindow = useCallback(
    async (sessionName: string, windowName: string): Promise<boolean> => {
      const result = await createWindow(sessionName, windowName)
      return result.ok
    },
    []
  )

  const handleExpandPane = useCallback((paneId: string) => setFullscreenPaneId(paneId), [])
  const handleCloseFullscreen = useCallback(() => setFullscreenPaneId(null), [])

  // Panel toggle handlers
  const handleOpenQuests = useCallback(() => setQuestsPanelOpen(true), [])
  const handleCloseQuests = useCallback(() => setQuestsPanelOpen(false), [])
  const handleOpenScratchpad = useCallback(() => setScratchpadPanelOpen(true), [])
  const handleCloseScratchpad = useCallback(() => setScratchpadPanelOpen(false), [])

  const paneActions = useMemo<PaneActionsContextValue>(() => ({
    onSendPrompt: sendPromptToPane,
    onSendSignal: sendSignalToPane,
    onDismissWaiting: dismissWaiting,
    onExpandPane: handleExpandPane,
    onRefreshPane: refreshPane,
    onClosePane: closePane,
    rpgEnabled,
  }), [handleExpandPane, rpgEnabled])

  const fullscreenData = useMemo(() => {
    if (!fullscreenPaneId) return null
    for (const window of windows) {
      const pane = window.panes.find(p => p.id === fullscreenPaneId)
      if (pane) return { pane, window }
    }
    return null
  }, [fullscreenPaneId, windows])

  const otherAttentionCount = useMemo(() => {
    if (!fullscreenPaneId) return 0
    return attentionPanes.filter(p => p.id !== fullscreenPaneId).length
  }, [attentionPanes, fullscreenPaneId])

  return (
    <PaneActionsProvider value={paneActions}>
      <OverviewDashboard
        windows={windows}
        attentionCount={attentionPanes.length}
        connected={connected}
        reconnectAttempt={reconnectAttempt}
        onRetry={forceReconnect}
        onNewPane={createPaneInWindow}
        onCreateWindow={handleCreateWindow}
        onRenameWindow={renameWindow}
        onOpenQuests={handleOpenQuests}
        onOpenScratchpad={handleOpenScratchpad}
      />

      {fullscreenData && (
        <FullScreenPane
          pane={fullscreenData.pane}
          window={fullscreenData.window}
          attentionCount={otherAttentionCount}
          onClose={handleCloseFullscreen}
        />
      )}

      {/* Quests slide-out panel */}
      <SlidePanel
        open={questsPanelOpen}
        onClose={handleCloseQuests}
        title="Quests"
      >
        <QuestsPanel showProjects={false} />
      </SlidePanel>

      {/* Scratchpad slide-out panel */}
      <SlidePanel
        open={scratchpadPanelOpen}
        onClose={handleCloseScratchpad}
        title="Scratchpad"
      >
        <ScratchpadPanel autoFocus />
      </SlidePanel>
    </PaneActionsProvider>
  )
}
