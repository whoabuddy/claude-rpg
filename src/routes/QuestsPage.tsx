import { useMemo, useState, useCallback } from 'react'
import { useConnectionStatus } from '../hooks/useConnection'
import { useQuests } from '../hooks/useQuests'
import { useStore } from '../store'
import { PaneActionsProvider, type PaneActionsContextValue } from '../contexts/PaneActionsContext'
import { PageHeader } from '../components/PageHeader'
import { QuestCard } from '../components/QuestCard'
import { WorkersSummary } from '../components/WorkersSummary'
import { ProjectMiniCard } from '../components/ProjectMiniCard'
import { FullScreenPane } from '../components/FullScreenPane'
import {
  sendPromptToPane,
  sendSignalToPane,
  dismissWaiting,
  refreshPane,
  closePane,
} from '../lib/api'
import type { Companion, Quest } from '../../shared/types'

export default function QuestsPage() {
  const { connected } = useConnectionStatus()
  const windows = useStore(state => state.windows)
  const companions = useStore(state => state.companions)
  const { quests, activeQuests, loading } = useQuests()

  // Fullscreen pane state
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null)

  // Memoize quest filtering to prevent recalculation on unrelated re-renders
  const completedQuests = useMemo(() => quests.filter(q => q.status === 'completed'), [quests])
  const pausedQuests = useMemo(() => quests.filter(q => q.status === 'paused'), [quests])

  // Memoize sliced companions to prevent re-render of ProjectsSection
  const recentCompanions = useMemo(() => companions.slice(0, 6), [companions])

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
        <PageHeader title="Quests">
          {!connected && (
            <span className="text-xs text-rpg-error">Disconnected</span>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Active Workers section - shows even with 1 worker on quests page */}
          <WorkersSummary
            windows={windows}
            onExpandPane={handleExpandPane}
            minWorkers={1}
            collapsible={false}
          />

          {/* Quests section */}
          <QuestsSection
            quests={quests}
            activeQuests={activeQuests}
            pausedQuests={pausedQuests}
            completedQuests={completedQuests}
            loading={loading}
          />

          {/* Recent Projects section */}
          <ProjectsSection companions={recentCompanions} />
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

interface QuestsSectionProps {
  quests: Quest[]
  activeQuests: Quest[]
  pausedQuests: Quest[]
  completedQuests: Quest[]
  loading: boolean
}

function QuestsSection({ quests, activeQuests, pausedQuests, completedQuests, loading }: QuestsSectionProps) {
  if (loading) {
    return (
      <section>
        <h2 className="text-sm font-medium text-rpg-text-muted mb-3">Quests</h2>
        <div className="text-center py-8 text-rpg-text-dim">Loading quests...</div>
      </section>
    )
  }

  if (quests.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-medium text-rpg-text-muted mb-3">Quests</h2>
        <div className="text-center py-8 space-y-2">
          <p className="text-rpg-text-dim">No quests yet</p>
          <p className="text-xs text-rpg-text-muted">
            Run <code className="px-1 py-0.5 bg-rpg-border rounded">/quest-create "Goal"</code> in Claude Code to create one
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      <QuestListSection title="Active Quests" quests={activeQuests} />
      <QuestListSection title="Paused" quests={pausedQuests} />
      <QuestListSection title="Completed" quests={completedQuests} />
    </>
  )
}

interface QuestListSectionProps {
  title: string
  quests: Quest[]
}

function QuestListSection({ title, quests }: QuestListSectionProps) {
  if (quests.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
        {title} ({quests.length})
      </h2>
      <div className="space-y-3">
        {quests.map(quest => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </section>
  )
}

interface ProjectsSectionProps {
  companions: Companion[]
}

function ProjectsSection({ companions }: ProjectsSectionProps) {
  if (companions.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
        Recent Projects
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {companions.map(c => (
          <ProjectMiniCard key={c.id} companion={c} />
        ))}
      </div>
    </section>
  )
}
