import { useQuests } from '../hooks/useQuests'
import { QuestCard } from './QuestCard'

interface QuestsPageProps {
  connected: boolean
  onNavigateBack: () => void
}

export function QuestsPage({ connected, onNavigateBack }: QuestsPageProps) {
  const { quests, activeQuests, loading } = useQuests()

  const completedQuests = quests.filter(q => q.status === 'completed')
  const pausedQuests = quests.filter(q => q.status === 'paused')

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onNavigateBack}
          className="text-rpg-text-muted hover:text-rpg-text transition-colors"
        >
          &larr;
        </button>
        <h1 className="text-lg font-bold">Quests</h1>
        {!connected && (
          <span className="text-xs text-rpg-error ml-auto">Disconnected</span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-rpg-text-dim">Loading quests...</div>
      ) : quests.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-rpg-text-dim">No quests yet</p>
          <p className="text-xs text-rpg-text-muted">
            Run <code className="px-1 py-0.5 bg-rpg-border rounded">/quest "Goal"</code> in Claude Code to create one
          </p>
        </div>
      ) : (
        <>
          {/* Active quests */}
          {activeQuests.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-rpg-text-muted mb-2">
                Active ({activeQuests.length})
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
              <h2 className="text-sm font-medium text-rpg-text-muted mb-2">
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
              <h2 className="text-sm font-medium text-rpg-text-muted mb-2">
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
      )}
    </div>
  )
}
