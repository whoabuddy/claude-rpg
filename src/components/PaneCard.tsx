import { useState, useRef, memo, useCallback, useEffect } from 'react'
import type { TmuxPane, TmuxWindow, SessionError } from '@shared/types'
import { sendPromptToPane, sendArrowKey } from '../lib/api'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { useConfirmAction } from '../hooks/useConfirmAction'
import { useQuests } from '../hooks/useQuests'
import { usePaneActivity } from '../store'
import { getPaneStatus, paneEqual } from '../utils/pane-status'
import { STATUS_LABELS, STATUS_THEME } from '../constants/status'
import { usePaneActions } from '../contexts/PaneActionsContext'
import { QuestionInput } from './QuestionInput'
import { TerminalDisplay } from './TerminalDisplay'
import { PaneAvatar } from './PaneAvatar'
import { StatusIndicator } from './StatusIndicator'
import { RepoStatusBar } from './RepoStatusBar'
import { TerminalPromptUI } from './TerminalPromptUI'
import { PaneInput } from './PaneInput'
import { ClaudeActivity } from './ClaudeActivity'
import { GitHubLinks } from './GitHubLinks'
import { SessionStatsBar } from './SessionStatsBar'
import { ActionButton } from './ActionButton'

interface PaneCardProps {
  pane: TmuxPane
  window: TmuxWindow
  compact?: boolean
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Truncate long strings with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

export const PaneCard = memo(function PaneCard({ pane, window, compact = false }: PaneCardProps) {
  const { onSendPrompt, onSendSignal, onDismissWaiting, onExpandPane, onRefreshPane, onClosePane, rpgEnabled } = usePaneActions()
  const [expanded, setExpanded] = useState(false)
  const [visibleError, setVisibleError] = useState<SessionError | null>(null)
  const [fadingOut, setFadingOut] = useState(false)
  const terminalContent = usePaneTerminal(pane.id)
  const activity = usePaneActivity(pane.id)
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // After copying from terminal, refocus the input (#62)
  const handleTerminalCopy = useCallback(() => {
    const input = inputAreaRef.current?.querySelector('textarea, input') as HTMLElement | null
    input?.focus()
  }, [])

  const closeConfirm = useConfirmAction(useCallback(() => onClosePane(pane.id), [onClosePane, pane.id]))

  // Error timeout and fade logic
  useEffect(() => {
    // Clear any pending fade timeout on effect re-run
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = null
    }

    const session = pane.process.claudeSession
    if (!session?.lastError) {
      // No error or error was cleared - hide visible error
      if (visibleError) {
        setFadingOut(true)
        fadeTimeoutRef.current = setTimeout(() => {
          setVisibleError(null)
          setFadingOut(false)
        }, 500) // Match CSS animation duration
      }
      return () => {
        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current)
          fadeTimeoutRef.current = null
        }
      }
    }

    // New error or error changed - show immediately
    if (!visibleError || visibleError.timestamp !== session.lastError.timestamp) {
      setVisibleError(session.lastError)
      setFadingOut(false)
    }

    // Set timeout to fade after 5s of inactivity
    const timeout = setTimeout(() => {
      const timeSinceError = Date.now() - session.lastError.timestamp
      if (timeSinceError >= 5000 && session.status === 'error') {
        setFadingOut(true)
        fadeTimeoutRef.current = setTimeout(() => {
          setVisibleError(null)
          setFadingOut(false)
        }, 500)
      }
    }, 5000)

    return () => {
      clearTimeout(timeout)
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current)
        fadeTimeoutRef.current = null
      }
    }
  }, [pane.process.claudeSession?.lastError, visibleError])

  const handleDismissError = useCallback(() => {
    setFadingOut(true)
    setTimeout(() => {
      setVisibleError(null)
      setFadingOut(false)
    }, 500)
  }, [])

  const { questForRepo } = useQuests()

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession
  const status = getPaneStatus(pane)
  const activeQuest = pane.repo ? questForRepo(pane.repo.name) : undefined
  const questCurrentPhase = activeQuest?.phases.find(p => p.status !== 'completed' && p.status !== 'pending')
    || activeQuest?.phases.find(p => p.status === 'pending')

  const theme = STATUS_THEME[status as keyof typeof STATUS_THEME] || STATUS_THEME.idle
  const statusLabel = STATUS_LABELS[status] || status

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDismissWaiting(pane.id)
  }, [onDismissWaiting, pane.id])

  const handleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onExpandPane(pane.id)
  }, [onExpandPane, pane.id])

  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onRefreshPane(pane.id)
  }, [onRefreshPane, pane.id])

  const handleCloseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    closeConfirm.handleClick()
  }, [closeConfirm])

  const handleCancelClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    closeConfirm.handleCancel()
  }, [closeConfirm])

  // Handler for terminal-detected prompts (permissions use single keys)
  const handleTerminalPromptAnswer = useCallback((answer: string, isPermission?: boolean) => {
    sendPromptToPane(pane.id, answer, isPermission ? { isPermissionResponse: true } : undefined)
  }, [pane.id])

  const handleCancelPrompt = useCallback(() => {
    sendPromptToPane(pane.id, 'Escape')
  }, [pane.id])

  const handleAnswer = useCallback((answer: string) => {
    onSendPrompt(pane.id, answer)
  }, [onSendPrompt, pane.id])

  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    sendArrowKey(pane.id, direction)
  }, [pane.id])

  // Compact mode: simpler display for idle panes
  if (compact && !expanded) {
    return (
      <div
        className={`rounded-lg border ${theme.border} bg-rpg-card card-interactive cursor-pointer hover:border-rpg-accent`}
        onClick={toggleExpanded}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          <PaneAvatar pane={pane} size="sm" activity={activity} />
          {pane.repo ? (
            <>
              <span className="text-sm text-rpg-accent truncate">
                {pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name}
                {pane.repo.branch && `:${pane.repo.branch}`}
              </span>
              {isClaudePane && session && (
                <span className="text-xs text-rpg-text-dim truncate">&middot; {session.name}</span>
              )}
            </>
          ) : (
            <span className="text-sm text-rpg-text-muted truncate">
              {isClaudePane && session ? session.name : pane.process.command}
            </span>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-rpg-text-muted">{statusLabel}</span>
            <div className={`w-2 h-2 rounded-full ${theme.indicator} ${
              status === 'working' || status === 'typing' || status === 'process' ? 'animate-pulse' : ''
            }`} />
            <span className="text-rpg-text-dim text-xs">▼</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.glow} transition-all`}>
      {/* Header - always visible */}
      <div className="p-3 cursor-pointer" onClick={toggleExpanded}>
        <div className="flex items-center gap-3">
          <PaneAvatar pane={pane} activity={activity} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {pane.repo ? (
                <>
                  <RepoStatusBar repo={pane.repo} compact />
                  {isClaudePane && session && (
                    <span className="text-xs text-rpg-text-muted">&middot; {session.name}</span>
                  )}
                </>
              ) : isClaudePane && session ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-xs px-1 py-0.5 rounded bg-rpg-accent/20 text-rpg-accent font-medium" title="Worker">W</span>
                  <span className="font-medium text-sm">{session.name}</span>
                </span>
              ) : (
                <span className="font-mono text-sm">{pane.process.command}</span>
              )}
            </div>

            {/* Activity line */}
            <div className="text-sm text-rpg-text-muted truncate">
              {isClaudePane && session ? (
                <ClaudeActivity session={session} />
              ) : (
                <span className="text-rpg-text-dim">
                  <span className="text-rpg-text-dim">cwd:</span> {pane.cwd.split('/').slice(-2).join('/')}
                </span>
              )}
            </div>

            {/* Last prompt */}
            {isClaudePane && session?.lastPrompt && (
              <p className="text-xs text-rpg-text-dim mt-1 truncate">
                <span className="text-rpg-text-muted">Last:</span> {session.lastPrompt}
              </p>
            )}

            {/* Quest badge */}
            {activeQuest && questCurrentPhase && (
              <div className="text-xs text-rpg-accent/80 truncate mt-0.5">
                Quest: {activeQuest.name} &middot; Phase {questCurrentPhase.order}/{activeQuest.phases.length}
              </div>
            )}
          </div>

          {/* Status + Actions — aligned together */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <StatusIndicator status={status} onDismiss={handleDismiss} />
            {closeConfirm.confirming ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-rpg-error/20 rounded text-xs">
                <span className="text-rpg-error">Close?</span>
                <button
                  onClick={handleCancelClose}
                  className="px-1.5 py-0.5 bg-rpg-idle/30 hover:bg-rpg-idle/50 rounded transition-colors"
                >
                  No
                </button>
                <button
                  onClick={handleCloseClick}
                  className="px-1.5 py-0.5 bg-rpg-error/50 hover:bg-rpg-error/70 text-white rounded transition-colors"
                >
                  Yes
                </button>
              </div>
            ) : (
              <>
                {(status === 'working' || status === 'waiting') && (
                  <ActionButton
                    icon="⏹"
                    label="Interrupt (Ctrl+C)"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSendSignal(pane.id, 'SIGINT') }}
                    variant="danger"
                    iconOnly
                  />
                )}
                <ActionButton icon="×" label="Close" onClick={handleCloseClick} variant="danger" iconOnly />
                <ActionButton icon="↻" label="Refresh" onClick={handleRefresh} iconOnly />
                <ActionButton icon="⛶" label="Expand" onClick={handleExpand} iconOnly />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error details (Claude only) - improved UX with dismiss and fade */}
      {isClaudePane && visibleError && !session?.pendingQuestion && (
        <div className={`px-3 pb-3 ${fadingOut ? 'error-fade-out' : ''}`}>
          <div className="relative p-2 bg-rpg-error/10 rounded border border-rpg-error/30">
            <button
              onClick={handleDismissError}
              className="absolute top-1 right-1 text-rpg-error/50 hover:text-rpg-error transition-colors"
              title="Dismiss error"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
            <div className="pr-6">
              <span className="text-xs text-rpg-error/80">
                <span className="font-medium">{visibleError.tool}:</span> {truncate(visibleError.message || 'Failed', 100)}
              </span>
              <span className="text-xs text-rpg-text-dim ml-2">
                {formatRelativeTime(visibleError.timestamp)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {pane.repo?.org && <GitHubLinks repo={pane.repo} />}

          {rpgEnabled && isClaudePane && session && (
            <SessionStatsBar stats={session.stats} />
          )}

          {/* Subagent list (#32) */}
          {isClaudePane && session?.activeSubagents && session.activeSubagents.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-rpg-text-muted">
                {session.activeSubagents.length} subagent{session.activeSubagents.length > 1 ? 's' : ''} running
              </div>
              {session.activeSubagents.slice(0, 5).map(sub => (
                <div key={sub.id} className="flex items-center gap-1.5 text-xs bg-rpg-bg rounded px-2 py-1 border border-rpg-border-dim">
                  <span className="text-rpg-accent animate-pulse">*</span>
                  <span className="text-rpg-text truncate">{sub.description}</span>
                  {sub.prompt && (
                    <span className="text-rpg-text-dim truncate hidden sm:inline" title={sub.prompt}>
                      — {sub.prompt}
                    </span>
                  )}
                </div>
              ))}
              {session.activeSubagents.length > 5 && (
                <div className="text-xs text-rpg-text-dim pl-2">
                  +{session.activeSubagents.length - 5} more
                </div>
              )}
            </div>
          )}

          {/* Terminal with prompt overlays */}
          <div className="relative">
            <TerminalDisplay content={terminalContent} onCopy={handleTerminalCopy} />

            {/* Prompt overlays on terminal area */}
            {isClaudePane && session?.terminalPrompt && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-rpg-bg/95 backdrop-blur-sm border-t border-rpg-border">
                <TerminalPromptUI
                  prompt={session.terminalPrompt}
                  onAnswer={handleTerminalPromptAnswer}
                  onCancel={handleCancelPrompt}
                  onNavigate={handleNavigate}
                />
              </div>
            )}

            {isClaudePane && session?.pendingQuestion && !session?.terminalPrompt && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-rpg-bg/95 backdrop-blur-sm border-t border-rpg-border">
                <QuestionInput
                  pendingQuestion={session.pendingQuestion}
                  onAnswer={handleAnswer}
                  compact={true}
                />
              </div>
            )}
          </div>

          {/* Input - always visible */}
          <div ref={inputAreaRef}>
            <PaneInput
              paneId={pane.id}
              pane={pane}
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
              variant="card"
            />
          </div>
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  if (prev.compact !== next.compact) return false
  return paneEqual(prev.pane, next.pane)
})
