import { useState, useCallback } from 'react'
import type { Quest, QuestPhase, QuestPhaseStatus } from '@shared/types'

interface QuestCardProps {
  quest: Quest
}

const PHASE_STATUS_COLORS: Record<QuestPhaseStatus, string> = {
  pending: 'bg-rpg-text-dim/30',
  planning: 'bg-blue-500/60',
  planned: 'bg-blue-500/80',
  executing: 'bg-yellow-500/80',
  verifying: 'bg-orange-500/80 animate-pulse',
  retrying: 'bg-orange-500/80 animate-pulse',
  completed: 'bg-green-500/80',
  failed: 'bg-rpg-error/80',
}

const PHASE_STATUS_LABELS: Record<QuestPhaseStatus, string> = {
  pending: 'Pending',
  planning: 'Planning',
  planned: 'Planned',
  executing: 'Executing',
  verifying: 'Verifying',
  retrying: 'Retrying',
  completed: 'Complete',
  failed: 'Failed',
}

function PhaseSegment({ phase, isActive }: { phase: QuestPhase; isActive: boolean }) {
  const color = PHASE_STATUS_COLORS[phase.status]
  return (
    <div
      className={`flex-1 h-2 rounded-full ${color} ${isActive ? 'ring-1 ring-rpg-accent ring-offset-1 ring-offset-rpg-card' : ''}`}
      title={`${phase.name}: ${PHASE_STATUS_LABELS[phase.status]}${phase.retryCount > 0 ? ` (Attempt ${phase.retryCount + 1}/${phase.maxRetries})` : ''}`}
    />
  )
}

function PhaseListItem({ phase }: { phase: QuestPhase }) {
  const statusIcon = {
    pending: '--',
    planning: '..',
    planned: '>>',
    executing: '=>',
    verifying: '??',
    retrying: '!!',
    completed: 'OK',
    failed: 'XX',
  }[phase.status]

  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className={`font-mono text-xs w-6 text-center ${
        phase.status === 'completed' ? 'text-green-400' :
        phase.status === 'failed' ? 'text-rpg-error' :
        phase.status === 'executing' || phase.status === 'verifying' || phase.status === 'retrying' ? 'text-yellow-400' :
        'text-rpg-text-dim'
      }`}>
        {statusIcon}
      </span>
      <span className={`flex-1 truncate ${phase.status === 'completed' ? 'text-rpg-text-muted line-through' : ''}`}>
        {phase.name}
      </span>
      {phase.taskCount !== undefined && (
        <span className="text-xs text-rpg-text-dim">{phase.taskCount} tasks</span>
      )}
      {phase.retryCount > 0 && (
        <span className="text-xs text-orange-400">
          {phase.retryCount}/{phase.maxRetries}
        </span>
      )}
    </div>
  )
}

export function QuestCard({ quest }: QuestCardProps) {
  const [expanded, setExpanded] = useState(false)
  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])

  const completedCount = quest.phases.filter(p => p.status === 'completed').length
  const totalCount = quest.phases.length
  const currentPhase = quest.phases.find(p => p.status !== 'completed' && p.status !== 'pending')
    || quest.phases.find(p => p.status === 'pending')

  const isActive = quest.status === 'active'
  const isCompleted = quest.status === 'completed'

  const timeSinceCreated = formatTimeAgo(quest.createdAt)

  return (
    <div className={`rounded-lg border ${
      isCompleted ? 'border-green-500/30 bg-green-500/5' :
      isActive ? 'border-rpg-accent/30 bg-rpg-card' :
      'border-rpg-border bg-rpg-card/50'
    }`}>
      {/* Header */}
      <div className="p-3 cursor-pointer" onClick={toggleExpanded}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-medium ${isCompleted ? 'text-green-400' : ''}`}>
            {quest.name}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isCompleted ? 'bg-green-500/20 text-green-400' :
            quest.status === 'paused' ? 'bg-rpg-text-dim/20 text-rpg-text-dim' :
            'bg-rpg-accent/20 text-rpg-accent'
          }`}>
            {quest.status}
          </span>
          <span className="text-xs text-rpg-text-dim ml-auto">{timeSinceCreated}</span>
          <span className="text-rpg-text-dim text-xs w-4 text-center">
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>

        {quest.description && (
          <p className="text-xs text-rpg-text-muted mb-2 truncate">{quest.description}</p>
        )}

        {/* Phase progress bar */}
        <div className="flex gap-1 mb-1.5">
          {quest.phases.map(phase => (
            <PhaseSegment
              key={phase.id}
              phase={phase}
              isActive={currentPhase?.id === phase.id}
            />
          ))}
        </div>

        {/* Current phase detail */}
        {currentPhase && isActive && (
          <div className="flex items-center gap-2 text-xs text-rpg-text-muted">
            <span>Phase {currentPhase.order}/{totalCount}</span>
            <span>&middot;</span>
            <span>{currentPhase.name}</span>
            <span>&middot;</span>
            <span className={
              currentPhase.status === 'executing' ? 'text-yellow-400' :
              currentPhase.status === 'verifying' || currentPhase.status === 'retrying' ? 'text-orange-400' :
              ''
            }>
              {PHASE_STATUS_LABELS[currentPhase.status]}
            </span>
            {currentPhase.retryCount > 0 && (
              <span className="text-orange-400">
                (Attempt {currentPhase.retryCount + 1}/{currentPhase.maxRetries})
              </span>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="text-xs text-green-400">
            {completedCount}/{totalCount} phases completed
          </div>
        )}

        {/* Repo badges */}
        {quest.repos.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {quest.repos.map(repo => (
              <span key={repo} className="text-xs px-1.5 py-0.5 rounded bg-rpg-border text-rpg-text-muted">
                {repo}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded phase list */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-rpg-border/50">
          <div className="mt-2">
            {quest.phases.map(phase => (
              <PhaseListItem key={phase.id} phase={phase} />
            ))}
          </div>
          {quest.phases.some(p => p.gaps && p.gaps.length > 0) && (
            <div className="mt-2 p-2 bg-rpg-error/10 rounded border border-rpg-error/20">
              <p className="text-xs text-rpg-error font-medium mb-1">Gaps Found:</p>
              {quest.phases
                .filter(p => p.gaps && p.gaps.length > 0)
                .flatMap(p => p.gaps!.map((gap, i) => (
                  <p key={`${p.id}-${i}`} className="text-xs text-rpg-text-muted">- {gap}</p>
                )))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
