import { useState, useRef, memo, useCallback, useEffect } from 'react'
import type { TmuxPane, TmuxWindow, SessionError } from '@shared/types'
import { sendPromptToPane, sendArrowKey } from '../lib/api'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { useConfirmAction } from '../hooks/useConfirmAction'
import { useQuests } from '../hooks/useQuests'
import { usePaneActivity } from '../store'
import { getPaneStatus, paneEqual } from '../utils/pane-status'
import { STATUS_LABELS, STATUS_THEME, getStatusDotClass } from '../constants/status'
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
  const { onSendPrompt, onSendSignal, onDismissWaiting, onExpandPane, onRefreshPane, onClosePane } = usePaneActions()
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

  // Compact mode: game-UI inspired - clear identity, status bar, readable
  if (compact && !expanded) {
    const isPulsing = status === 'working' || status === 'typing' || status === 'process'
    const name = isClaudePane && session ? session.name : pane.process.command

    return (
      <div
        className={`rounded-lg border-2 ${theme.border} bg-rpg-card cursor-pointer hover:bg-rpg-card-hover active:scale-[0.98] transition-all`}
        onClick={toggleExpanded}
      >
        {/* Status bar at top - like a health bar */}
        <div className={`h-1.5 rounded-t-md ${theme.bg}`} />

        <div className="px-3 py-2 flex items-center gap-2 min-h-[48px]">
          {/* Status dot */}
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDotClass(status)}`} />

          {/* Name - always visible */}
          <span className="font-medium text-rpg-text truncate max-w-[100px] flex-shrink-0">{name}</span>

          {/* Repo - responsive, fills remaining space */}
          {pane.repo && (
            <span className="text-sm text-rpg-accent truncate min-w-0 flex-1">
              <span className="sm:hidden">{pane.repo.name}</span>
              <span className="hidden sm:inline">{pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name}</span>
            </span>
          )}

          {/* Last activity */}
          {session?.lastActivity && (
            <span className="text-xs text-rpg-text-dim flex-shrink-0">{formatRelativeTime(session.lastActivity)}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border-2 ${theme.border} ${theme.glow} transition-all overflow-hidden`}>
      {/* Status bar at top - like a health/mana bar */}
      <div className={`h-2 ${theme.bg} ${
        status === 'working' || status === 'typing' ? 'animate-pulse' : ''
      }`} />

      {/* Header - tap to collapse */}
      <div className="px-3 py-3 cursor-pointer bg-rpg-card hover:bg-rpg-card-hover transition-colors" onClick={toggleExpanded}>
        <div className="flex items-start gap-3">
          <PaneAvatar pane={pane} activity={activity} size="md" />

          {/* Info column */}
          <div className="flex-1 min-w-0">
            {/* Name - prominent */}
            <div className="font-semibold text-base text-rpg-text mb-0.5">
              {isClaudePane && session ? session.name : pane.process.command}
            </div>

            {/* Repo - secondary */}
            {pane.repo ? (
              <RepoStatusBar repo={pane.repo} compact />
            ) : (
              <span className="text-sm text-rpg-text-dim">
                {pane.cwd.split('/').slice(-2).join('/')}
              </span>
            )}

            {/* Activity line */}
            {isClaudePane && session && (
              <div className="text-sm text-rpg-text-muted mt-1">
                <ClaudeActivity session={session} />
              </div>
            )}

            {/* Quest badge */}
            {activeQuest && questCurrentPhase && (
              <div className="text-sm text-rpg-accent mt-1">
                {activeQuest.name} · Phase {questCurrentPhase.order}/{activeQuest.phases.length}
              </div>
            )}
          </div>

          {/* Status + Actions column */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* Status badge - larger touch target */}
            <StatusIndicator status={status} onDismiss={handleDismiss} />

            {/* Action buttons row */}
            {closeConfirm.confirming ? (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-rpg-error/20 rounded-lg">
                <span className="text-sm text-rpg-error">Close?</span>
                <button
                  onClick={handleCancelClose}
                  className="px-2.5 py-1 text-sm bg-rpg-idle/30 hover:bg-rpg-idle/50 rounded transition-colors"
                >
                  No
                </button>
                <button
                  onClick={handleCloseClick}
                  className="px-2.5 py-1 text-sm bg-rpg-error/50 hover:bg-rpg-error/70 text-white rounded transition-colors"
                >
                  Yes
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {(status === 'working' || status === 'waiting') && (
                  <ActionButton
                    icon="⏹"
                    label="Interrupt"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSendSignal(pane.id, 'SIGINT') }}
                    variant="danger"
                    iconOnly
                  />
                )}
                <ActionButton icon="×" label="Close" onClick={handleCloseClick} variant="danger" iconOnly />
                <ActionButton icon="↻" label="Refresh" onClick={handleRefresh} iconOnly />
                <ActionButton icon="⛶" label="Fullscreen" onClick={handleExpand} iconOnly />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error details (Claude only) - improved UX with dismiss and fade */}
      {isClaudePane && visibleError && !session?.pendingQuestion && (
        <div className={`px-2 pb-2 ${fadingOut ? 'error-fade-out' : ''}`}>
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
        <div className="px-2 pb-2 space-y-1.5">
          {pane.repo?.org && <GitHubLinks repo={pane.repo} />}

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
