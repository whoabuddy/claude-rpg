import { useMemo, useState, useCallback } from 'react'
import { useStore } from '../store'
import { PaneActionsProvider, type PaneActionsContextValue } from '../contexts/PaneActionsContext'
import { PageHeader } from '../components/PageHeader'
import { QuestsPanel } from '../components/QuestsPanel'
import { WorkersSummary } from '../components/WorkersSummary'
import { FullScreenPane } from '../components/FullScreenPane'
import {
  sendPromptToPane,
  sendSignalToPane,
  dismissWaiting,
  refreshPane,
  closePane,
} from '../lib/api'

/**
 * Quests page - standalone view for direct navigation.
 * Content is provided by QuestsPanel component.
 */
export default function QuestsPage() {
  const windows = useStore((state) => state.windows)

  // Fullscreen pane state
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null)

  // Fullscreen handlers
  const handleExpandPane = useCallback((paneId: string) => setFullscreenPaneId(paneId), [])
  const handleCloseFullscreen = useCallback(() => setFullscreenPaneId(null), [])

  // Pane actions for fullscreen view
  const paneActions = useMemo<PaneActionsContextValue>(() => ({
    onSendPrompt: sendPromptToPane,
    onSendSignal: sendSignalToPane,
    onDismissWaiting: dismissWaiting,
    onExpandPane: handleExpandPane,
    onRefreshPane: refreshPane,
    onClosePane: closePane,
    rpgEnabled: true,
  }), [handleExpandPane])

  // Find fullscreen pane data
  const fullscreenData = useMemo(() => {
    if (!fullscreenPaneId) return null
    for (const window of windows) {
      const pane = window.panes.find(p => p.id === fullscreenPaneId)
      if (pane) return { pane, window }
    }
    return null
  }, [fullscreenPaneId, windows])

  // Count other panes needing attention
  const otherAttentionCount = useMemo(() => {
    if (!fullscreenPaneId) return 0
    return windows.flatMap(w => w.panes).filter(p =>
      p.id !== fullscreenPaneId &&
      p.process.type === 'claude' &&
      (p.process.claudeSession?.status === 'waiting' || p.process.claudeSession?.status === 'error')
    ).length
  }, [windows, fullscreenPaneId])

  return (
    <PaneActionsProvider value={paneActions}>
      <div className="flex flex-col h-full">
        <PageHeader title="Quests" />

        <div className="flex-1 overflow-y-auto">
          {/* Active Workers section */}
          <div className="px-4 pt-4">
            <WorkersSummary
              windows={windows}
              onExpandPane={handleExpandPane}
              minWorkers={1}
              collapsible={false}
            />
          </div>

          {/* Quests content */}
          <QuestsPanel showProjects={true} />
        </div>
      </div>

      {/* Fullscreen pane overlay */}
      {fullscreenData && (
        <FullScreenPane
          pane={fullscreenData.pane}
          window={fullscreenData.window}
          attentionCount={otherAttentionCount}
          onClose={handleCloseFullscreen}
        />
      )}
    </PaneActionsProvider>
  )
}
