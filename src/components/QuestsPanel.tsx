import { useMemo } from 'react'
import { useQuests } from '../hooks/useQuests'
import { useStore } from '../store'
import { QuestCard } from './QuestCard'
import { ProjectMiniCard } from './ProjectMiniCard'
import type { Companion, Quest } from '../../shared/types'

interface QuestsPanelProps {
  /** Show loading state */
  loading?: boolean
  /** Show recent projects section */
  showProjects?: boolean
}

/**
 * Quests panel content - can be used in slide-out panel or standalone page.
 * Displays active, paused, and completed quests with optional project section.
 */
export function QuestsPanel({ loading = false, showProjects = true }: QuestsPanelProps) {
  const { quests, activeQuests } = useQuests()
  const companions = useStore((state) => state.companions)

  const completedQuests = useMemo(() => quests.filter(q => q.status === 'completed'), [quests])
  const pausedQuests = useMemo(() => quests.filter(q => q.status === 'paused'), [quests])
  const recentCompanions = useMemo(() => companions.slice(0, 6), [companions])

  return (
    <div className="p-4 space-y-6">
      {loading ? (
        <div className="text-center py-8 text-rpg-text-dim">Loading quests...</div>
      ) : quests.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <QuestListSection title="Active Quests" quests={activeQuests} />
          <QuestListSection title="Paused" quests={pausedQuests} />
          <QuestListSection title="Completed" quests={completedQuests} />
        </>
      )}

      {showProjects && recentCompanions.length > 0 && (
        <ProjectsSection companions={recentCompanions} />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-8 space-y-2">
      <p className="text-rpg-text-dim">No quests yet</p>
      <p className="text-xs text-rpg-text-muted">
        Run <code className="px-1 py-0.5 bg-rpg-border rounded">/quest-create "Goal"</code> in Claude Code to create one
      </p>
    </div>
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
  return (
    <section>
      <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
        Recent Projects
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {companions.map(c => (
          <ProjectMiniCard key={c.id} companion={c} />
        ))}
      </div>
    </section>
  )
}

/**
 * Compact quest summary for inline display on dashboard.
 * Shows count and current active quest name.
 */
export function QuestsSummary({ onOpenPanel }: { onOpenPanel: () => void }) {
  const { activeQuests } = useQuests()

  if (activeQuests.length === 0) {
    return null
  }

  const currentQuest = activeQuests[0]
  const currentPhase = currentQuest?.phases.find(p =>
    p.status !== 'completed' && p.status !== 'pending'
  )

  return (
    <button
      onClick={onOpenPanel}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rpg-card hover:bg-rpg-card-hover border border-rpg-border transition-colors text-left"
    >
      <span className="text-xs text-rpg-accent font-medium">
        {activeQuests.length} quest{activeQuests.length !== 1 ? 's' : ''}
      </span>
      {currentPhase && (
        <>
          <span className="text-rpg-text-dim">-</span>
          <span className="text-xs text-rpg-text-muted truncate max-w-[150px]">
            {currentPhase.name}
          </span>
        </>
      )}
      <svg className="w-4 h-4 text-rpg-text-dim ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
