import { useMemo } from 'react'
import { useConnectionStatus } from '../hooks/useConnection'
import { useQuests } from '../hooks/useQuests'
import { useStore } from '../store'
import { PageHeader } from '../components/PageHeader'
import { QuestCard } from '../components/QuestCard'
import { WorkerPill } from '../components/WorkerPill'
import { ProjectMiniCard } from '../components/ProjectMiniCard'
import type { TmuxPane, Companion } from '../../shared/types'

export default function QuestsPage() {
  const { connected } = useConnectionStatus()
  const windows = useStore(state => state.windows)
  const companions = useStore(state => state.companions)
  const { quests, activeQuests, loading } = useQuests()

  // Derive Claude panes
  const claudePanes = useMemo(() =>
    windows.flatMap(w => w.panes.filter(p => p.process.type === 'claude')),
    [windows]
  )

  const completedQuests = quests.filter(q => q.status === 'completed')
  const pausedQuests = quests.filter(q => q.status === 'paused')

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Quests">
        {!connected && (
          <span className="text-xs text-rpg-error">Disconnected</span>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Active Workers section */}
        <ActiveWorkersSection panes={claudePanes} />

        {/* Quests section */}
        <QuestsSection
          quests={quests}
          activeQuests={activeQuests}
          pausedQuests={pausedQuests}
          completedQuests={completedQuests}
          loading={loading}
        />

        {/* Recent Projects section */}
        <ProjectsSection companions={companions.slice(0, 6)} />
      </div>
    </div>
  )
}

interface ActiveWorkersSectionProps {
  panes: TmuxPane[]
}

function ActiveWorkersSection({ panes }: ActiveWorkersSectionProps) {
  if (panes.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
        Active Workers ({panes.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {panes.map(pane => (
          <WorkerPill key={pane.id} pane={pane} />
        ))}
      </div>
    </section>
  )
}

interface QuestsSectionProps {
  quests: any[]
  activeQuests: any[]
  pausedQuests: any[]
  completedQuests: any[]
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
            Run <code className="px-1 py-0.5 bg-rpg-border rounded">/quest "Goal"</code> in Claude Code to create one
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* Active quests */}
      {activeQuests.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
            Active Quests ({activeQuests.length})
          </h2>
          <div className="space-y-3">
            {activeQuests.map(quest => (
              <QuestCard key={quest.id} quest={quest} />
            ))}
          </div>
        </section>
      )}

      {/* Paused quests */}
      {pausedQuests.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
            Paused ({pausedQuests.length})
          </h2>
          <div className="space-y-3">
            {pausedQuests.map(quest => (
              <QuestCard key={quest.id} quest={quest} />
            ))}
          </div>
        </section>
      )}

      {/* Completed quests */}
      {completedQuests.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
            Completed ({completedQuests.length})
          </h2>
          <div className="space-y-3">
            {completedQuests.map(quest => (
              <QuestCard key={quest.id} quest={quest} />
            ))}
          </div>
        </section>
      )}
    </>
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
