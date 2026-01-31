import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
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
 * Game-UI style: larger tap target, clear hierarchy.
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
  const completedPhases = currentQuest?.phases.filter(p => p.status === 'completed').length || 0
  const totalPhases = currentQuest?.phases.length || 0

  return (
    <button
      onClick={onOpenPanel}
      className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-rpg-accent/10 hover:bg-rpg-accent/20 border border-rpg-accent/30 transition-colors text-left min-h-[56px] active:scale-[0.98]"
    >
      {/* Quest icon */}
      <div className="w-8 h-8 rounded-lg bg-rpg-accent/20 flex items-center justify-center flex-shrink-0">
        <span className="text-rpg-accent text-lg">Q</span>
      </div>

      {/* Quest info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-rpg-text truncate">
          {currentQuest?.name || 'Active Quest'}
        </div>
        {currentPhase && (
          <div className="text-sm text-rpg-text-muted">
            Phase {completedPhases + 1}/{totalPhases}: {currentPhase.name}
          </div>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-rpg-accent flex-shrink-0" />
    </button>
  )
}
