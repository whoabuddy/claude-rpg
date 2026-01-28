import { useState, useCallback } from 'react'
import type { Quest, QuestPhase, QuestPhaseStatus, QuestStatus } from '@shared/types'
import { updateQuestStatus, archiveQuest } from '../hooks/useQuests'

interface QuestCardProps {
  quest: Quest
}

const PHASE_STATUS_COLORS: Record<QuestPhaseStatus, string> = {
  pending: 'bg-rpg-text-dim/30',
  planned: 'bg-blue-500/80',
  executing: 'bg-yellow-500/80',
  retrying: 'bg-orange-500/80 animate-pulse',
  completed: 'bg-green-500/80',
  failed: 'bg-rpg-error/80',
  skipped: 'bg-rpg-text-dim/50',
}

const PHASE_STATUS_LABELS: Record<QuestPhaseStatus, string> = {
  pending: 'Pending',
  planned: 'Planned',
  executing: 'Executing',
  retrying: 'Retrying',
  completed: 'Complete',
  failed: 'Failed',
  skipped: 'Skipped',
}

const PHASE_STATUS_ICONS: Record<QuestPhaseStatus, string> = {
  pending: '\u25CB',    // ○ open circle
  planned: '\u25B8',    // ▸ right triangle
  executing: '\u25B6',  // ▶ play
  retrying: '\u21BB',   // ↻ refresh
  completed: '\u2713',  // ✓ check
  failed: '\u2717',     // ✗ cross
  skipped: '\u2014',    // — em dash
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

function PhaseTimelineItem({ phase, isActive }: { phase: QuestPhase; isActive: boolean }) {
  const statusIcon = PHASE_STATUS_ICONS[phase.status]
  const duration = phase.startedAt && phase.completedAt
    ? formatDuration(phase.completedAt - phase.startedAt)
    : phase.startedAt
    ? formatDuration(Date.now() - phase.startedAt)
    : null

  return (
    <div className={`flex items-start gap-3 py-2 ${isActive ? 'animate-glow' : ''}`}>
      {/* Status Icon */}
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
        phase.status === 'completed' ? 'border-green-500 bg-green-500/20 text-green-400' :
        phase.status === 'failed' ? 'border-rpg-error bg-rpg-error/20 text-rpg-error' :
        phase.status === 'executing' || phase.status === 'retrying' ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400' :
        phase.status === 'planned' ? 'border-blue-500 bg-blue-500/20 text-blue-400' :
        phase.status === 'skipped' ? 'border-rpg-text-dim bg-rpg-text-dim/20 text-rpg-text-dim' :
        'border-rpg-text-dim bg-rpg-text-dim/10 text-rpg-text-dim'
      }`}>
        <span className="text-sm">{statusIcon}</span>
      </div>

      {/* Phase Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-medium ${phase.status === 'completed' ? 'text-rpg-text-muted' : ''}`}>
            {phase.name}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            phase.status === 'completed' ? 'bg-green-500/20 text-green-400' :
            phase.status === 'failed' ? 'bg-rpg-error/20 text-rpg-error' :
            phase.status === 'executing' || phase.status === 'retrying' ? 'bg-yellow-500/20 text-yellow-400' :
            phase.status === 'planned' ? 'bg-blue-500/20 text-blue-400' :
            phase.status === 'skipped' ? 'bg-rpg-text-dim/30 text-rpg-text-dim' :
            'bg-rpg-text-dim/20 text-rpg-text-dim'
          }`}>
            {PHASE_STATUS_LABELS[phase.status]}
          </span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs text-rpg-text-muted">
          {duration && (
            <>
              <span>{duration}</span>
              <span>\u2022</span>
            </>
          )}
          {phase.xpEarned !== undefined && phase.xpEarned > 0 && (
            <>
              <span className="text-rpg-accent">{phase.xpEarned} XP</span>
              <span>\u2022</span>
            </>
          )}
          {phase.taskCount !== undefined && (
            <span>{phase.taskCount} tasks</span>
          )}
          {phase.retryCount > 0 && (
            <>
              <span>\u2022</span>
              <span className="text-orange-400">
                Attempt {phase.retryCount + 1}/{phase.maxRetries}
              </span>
            </>
          )}
        </div>

        {/* Gaps (if any) */}
        {phase.gaps && phase.gaps.length > 0 && (
          <div className="mt-1 text-xs text-rpg-error">
            {phase.gaps.map((gap, i) => (
              <div key={i}>\u2022 {gap}</div>
            ))}
          </div>
        )}
      </div>
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
  const isArchived = quest.status === 'archived'

  const timeSinceCreated = formatTimeAgo(quest.createdAt)
  const totalDuration = quest.createdAt && (quest.completedAt || quest.archivedAt)
    ? formatDuration((quest.completedAt || quest.archivedAt!) - quest.createdAt)
    : null

  return (
    <div className={`rounded-lg border ${
      isArchived ? 'border-purple-500/30 bg-purple-500/5' :
      isCompleted ? 'border-green-500/30 bg-green-500/5' :
      isActive ? 'border-rpg-accent/30 bg-rpg-card' :
      'border-rpg-border bg-rpg-card/50'
    }`}>
      {/* Header */}
      <div className="p-3 cursor-pointer" onClick={toggleExpanded}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-medium ${isArchived ? 'text-purple-400' : isCompleted ? 'text-green-400' : ''}`}>
            {quest.name}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isArchived ? 'bg-purple-500/20 text-purple-400' :
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
            <span>\u2022</span>
            <span>{currentPhase.name}</span>
            <span>\u2022</span>
            <span className={
              currentPhase.status === 'executing' ? 'text-yellow-400' :
              currentPhase.status === 'retrying' ? 'text-orange-400' :
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

        {/* Completed/archived quest summary */}
        {(isCompleted || isArchived) && (
          <div className="flex items-center gap-3 text-xs text-rpg-text-muted">
            <span className={isArchived ? 'text-purple-400' : 'text-green-400'}>{completedCount}/{totalCount} phases</span>
            {totalDuration && (
              <>
                <span>\u2022</span>
                <span>{totalDuration}</span>
              </>
            )}
            {quest.xpEarned !== undefined && quest.xpEarned > 0 && (
              <>
                <span>\u2022</span>
                <span className="text-rpg-accent">{quest.xpEarned} XP</span>
              </>
            )}
            {quest.commits !== undefined && quest.commits > 0 && (
              <>
                <span>\u2022</span>
                <span>{quest.commits} commits</span>
              </>
            )}
            {quest.testsRun !== undefined && quest.testsRun > 0 && (
              <>
                <span>\u2022</span>
                <span>{quest.testsRun} tests</span>
              </>
            )}
            {isArchived && quest.archiveSource === 'computed' && (
              <>
                <span>\u2022</span>
                <span className="text-purple-400/70">computed</span>
              </>
            )}
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

      {/* Expanded timeline view */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-rpg-border/50">
          {/* Completed/archived quest summary card */}
          {(isCompleted || isArchived) && (quest.xpEarned || quest.commits || quest.testsRun || quest.toolsUsed) && (
            <div className={`mt-3 p-3 rounded-lg ${isArchived ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
              <div className={`text-xs font-medium mb-2 ${isArchived ? 'text-purple-400' : 'text-green-400'}`}>
                {isArchived ? 'Quest Archived' : 'Quest Complete!'}{isArchived && quest.archiveSource === 'computed' && ' (stats computed)'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {quest.xpEarned !== undefined && quest.xpEarned > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-rpg-text-dim">XP:</span>
                    <span className="text-rpg-accent font-medium">{quest.xpEarned}</span>
                  </div>
                )}
                {totalDuration && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-rpg-text-dim">Duration:</span>
                    <span className="text-rpg-text">{totalDuration}</span>
                  </div>
                )}
                {quest.commits !== undefined && quest.commits > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-rpg-text-dim">Commits:</span>
                    <span className="text-rpg-text">{quest.commits}</span>
                  </div>
                )}
                {quest.testsRun !== undefined && quest.testsRun > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-rpg-text-dim">Tests:</span>
                    <span className="text-rpg-text">{quest.testsRun}</span>
                  </div>
                )}
              </div>
              {quest.toolsUsed && Object.keys(quest.toolsUsed).length > 0 && (
                <div className={`mt-2 pt-2 border-t ${isArchived ? 'border-purple-500/20' : 'border-green-500/20'}`}>
                  <div className="text-xs text-rpg-text-dim mb-1">Tools Used:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(quest.toolsUsed)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([tool, count]) => (
                        <span key={tool} className="text-xs px-1.5 py-0.5 rounded bg-rpg-card text-rpg-text-muted">
                          {tool} \u00D7{count}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {quest.repos.length > 0 && (
                <div className={`mt-2 pt-2 border-t ${isArchived ? 'border-purple-500/20' : 'border-green-500/20'}`}>
                  <div className="text-xs text-rpg-text-dim">
                    Contributed to {quest.repos.map((repo, i) => (
                      <span key={repo}>
                        {i > 0 && ', '}
                        <span className="text-rpg-accent">{repo}</span>
                      </span>
                    ))} leaderboard
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase Timeline */}
          <div className="mt-3 space-y-0 relative">
            {/* Timeline vertical line */}
            <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-rpg-border" />

            {quest.phases.map(phase => (
              <PhaseTimelineItem
                key={phase.id}
                phase={phase}
                isActive={currentPhase?.id === phase.id}
              />
            ))}
          </div>

          {/* Quest management controls (#81) */}
          {!isArchived && (
            <QuestControls questId={quest.id} status={quest.status} />
          )}
        </div>
      )}
    </div>
  )
}

function QuestControls({ questId, status }: { questId: string; status: QuestStatus }) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAction = useCallback(async (action: 'active' | 'paused' | 'completed' | 'archive') => {
    if (action === 'completed' && confirming !== 'complete') {
      setConfirming('complete')
      return
    }
    if (action === 'archive' && confirming !== 'archive') {
      setConfirming('archive')
      return
    }
    setLoading(true)
    setConfirming(null)
    if (action === 'archive') {
      await archiveQuest(questId)
    } else {
      await updateQuestStatus(questId, action)
    }
    setLoading(false)
  }, [questId, confirming])

  if (loading) {
    return <div className="mt-2 text-xs text-rpg-text-dim">Updating...</div>
  }

  if (confirming === 'complete') {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-rpg-text-muted">Mark as complete?</span>
        <button
          onClick={() => handleAction('completed')}
          className="px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(null)}
          className="px-2 py-1 rounded bg-rpg-border text-rpg-text-muted hover:bg-rpg-card-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (confirming === 'archive') {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-rpg-text-muted">Archive and compute stats?</span>
        <button
          onClick={() => handleAction('archive')}
          className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(null)}
          className="px-2 py-1 rounded bg-rpg-border text-rpg-text-muted hover:bg-rpg-card-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Completed quests show Archive button
  if (status === 'completed') {
    return (
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => handleAction('archive')}
          className="px-2 py-1 text-xs rounded bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
        >
          Archive
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {status === 'active' ? (
        <button
          onClick={() => handleAction('paused')}
          className="px-2 py-1 text-xs rounded bg-rpg-text-dim/20 text-rpg-text-muted hover:bg-rpg-text-dim/30 transition-colors"
        >
          Pause
        </button>
      ) : status === 'paused' ? (
        <button
          onClick={() => handleAction('active')}
          className="px-2 py-1 text-xs rounded bg-rpg-accent/20 text-rpg-accent hover:bg-rpg-accent/30 transition-colors"
        >
          Resume
        </button>
      ) : null}
      <button
        onClick={() => handleAction('completed')}
        className="px-2 py-1 text-xs rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
      >
        Complete
      </button>
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

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}
