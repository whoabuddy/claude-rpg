import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { PaneAvatar } from '../components/PaneAvatar'
import { StatusPill } from '../components/StatusPill'
import { TierBadge } from '../components/TierBadge'
import { PersonaBadges } from '../components/PersonaBadges'
import { HealthMeter } from '../components/HealthMeter'
import { ChallengeCard } from '../components/ChallengeCard'
import type { TmuxPane, PersonaChallenge } from '../../shared/types'

type Filter = 'all' | 'active' | 'idle'

/**
 * Personas page - shows all Claude sessions as characters
 */
export default function PersonasPage() {
  const windows = useStore((state) => state.windows)
  // Derive claudePanes using useMemo to avoid infinite loop
  const claudePanes = useMemo(() =>
    windows.flatMap(w => w.panes.filter(p => p.process.type === 'claude')),
    [windows]
  )
  const [filter, setFilter] = useState<Filter>('all')

  // Filter panes
  const filteredPanes = claudePanes.filter(p => {
    const status = p.process.claudeSession?.status
    if (filter === 'active') {
      return status === 'working' || status === 'waiting'
    }
    if (filter === 'idle') {
      return status === 'idle' || status === 'typing'
    }
    return true
  })

  // Group by status for display
  const activePanes = filteredPanes.filter(p =>
    p.process.claudeSession?.status === 'working' ||
    p.process.claudeSession?.status === 'waiting'
  )
  const idlePanes = filteredPanes.filter(p =>
    p.process.claudeSession?.status === 'idle' ||
    p.process.claudeSession?.status === 'typing'
  )

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-rpg-text">Personas</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-rpg-card border border-rpg-border rounded-lg p-0.5">
            {(['all', 'active', 'idle'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === f
                    ? 'bg-rpg-accent text-rpg-bg'
                    : 'text-rpg-text-muted hover:text-rpg-text'
                }`}
              >
                {f === 'all' ? 'All' : f === 'active' ? 'Working' : 'Ready'}
              </button>
            ))}
          </div>
          <span className="text-sm text-rpg-text-muted">
            {claudePanes.length} total
          </span>
        </div>
      </div>

      {/* Active personas */}
      {activePanes.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-rpg-text-muted mb-3">Working</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePanes.map(pane => (
              <PersonaCard key={pane.id} pane={pane} />
            ))}
          </div>
        </section>
      )}

      {/* Idle personas */}
      {idlePanes.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-rpg-text-muted mb-3">Ready</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {idlePanes.map(pane => (
              <PersonaCard key={pane.id} pane={pane} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {claudePanes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-rpg-text-dim mb-2">No active Claude sessions</p>
          <p className="text-sm text-rpg-text-muted">
            Start Claude Code in a tmux pane to see personas here
          </p>
        </div>
      )}
    </div>
  )
}

interface PersonaCardProps {
  pane: TmuxPane
}

function PersonaCard({ pane }: PersonaCardProps) {
  const session = pane.process.claudeSession
  const [challenges] = useState<PersonaChallenge[]>([])

  if (!session) return null

  // Use health data from session if available, otherwise compute mock values
  const health = session.health || {
    energy: session.status === 'working' ? 65 : session.status === 'idle' ? 85 : 75,
    morale: session.stats ? Math.min(100, 50 + (session.stats.totalXPGained / 10)) : 50,
    lastUpdated: new Date().toISOString(),
  }

  // Mock challenges (will be fetched from API in future)
  // For now, show empty state or placeholder
  // TODO: Fetch challenges via GET /api/personas/:id/challenges when endpoint is ready

  return (
    <div className="p-4 rounded-lg border border-rpg-border bg-rpg-card hover:border-rpg-accent/50 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <PaneAvatar pane={pane} size="lg" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-rpg-text truncate">{session.name}</span>
            <TierBadge tier={session.tier || 'novice'} />
            <StatusPill status={session.status} size="sm" />
          </div>

          {/* Current activity */}
          {session.currentTool && (
            <p className="text-xs text-rpg-text-muted mt-1 truncate">
              Using {session.currentTool}
              {session.currentFile && ` on ${session.currentFile.split('/').pop()}`}
            </p>
          )}

          {/* Project */}
          {pane.repo && (
            <p className="text-xs text-rpg-text-dim mt-1 truncate">
              {pane.repo.name}
            </p>
          )}

          {/* Stats */}
          {session.stats && (
            <div className="flex gap-3 mt-2 text-xs text-rpg-text-muted">
              <span>{session.stats.totalXPGained} XP</span>
              <span>{session.stats.promptsReceived} prompts</span>
            </div>
          )}

          {/* Badges row */}
          {session.badges && session.badges.length > 0 && (
            <div className="mt-2">
              <PersonaBadges badges={session.badges} />
            </div>
          )}
        </div>
      </div>

      {/* Health meters */}
      <div className="space-y-2 mb-3">
        <HealthMeter label="Energy" value={health.energy} size="sm" />
        <HealthMeter label="Morale" value={health.morale} size="sm" />
      </div>

      {/* Challenges section (placeholder until backend is ready) */}
      {challenges.length > 0 && (
        <div className="mt-3 space-y-2">
          <h4 className="text-xs font-medium text-rpg-text-muted">Active Challenges</h4>
          {challenges.slice(0, 2).map(challenge => (
            <ChallengeCard key={challenge.id} challenge={challenge} compact />
          ))}
        </div>
      )}

      {/* Personality (expandable) */}
      {(session.personality?.backstory || session.personality?.quirk) && (
        <details className="mt-3 text-xs text-rpg-text-dim">
          <summary className="cursor-pointer hover:text-rpg-text-muted">Personality</summary>
          {session.personality.backstory && (
            <p className="mt-1">{session.personality.backstory}</p>
          )}
          {session.personality.quirk && (
            <p className="mt-1 italic">"{session.personality.quirk}"</p>
          )}
        </details>
      )}
    </div>
  )
}
