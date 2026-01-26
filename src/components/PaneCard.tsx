import { useState, memo, useCallback } from 'react'
import type { TmuxPane, TmuxWindow } from '@shared/types'
import { sendPromptToPane } from '../hooks/useWindows'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { useConfirmAction } from '../hooks/useConfirmAction'
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

interface PaneCardProps {
  pane: TmuxPane
  window: TmuxWindow
  compact?: boolean
}

export const PaneCard = memo(function PaneCard({ pane, window, compact = false }: PaneCardProps) {
  const { onSendPrompt, onSendSignal, onDismissWaiting, onExpandPane, onRefreshPane, onClosePane, rpgEnabled } = usePaneActions()
  const [expanded, setExpanded] = useState(false)
  const terminalContent = usePaneTerminal(pane.id)

  const closeConfirm = useConfirmAction(useCallback(() => onClosePane(pane.id), [onClosePane, pane.id]))

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession
  const status = getPaneStatus(pane)

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

  // Compact mode: simpler display for idle panes
  if (compact && !expanded) {
    return (
      <div
        className={`rounded-lg border ${theme.border} bg-rpg-card card-interactive cursor-pointer hover:border-rpg-accent`}
        onClick={toggleExpanded}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          <PaneAvatar pane={pane} size="sm" />
          <span className="text-sm text-rpg-text-muted truncate">
            {isClaudePane && session ? session.name : pane.process.command}
          </span>
          {pane.repo && (
            <span className="text-xs text-rpg-accent-dim truncate">
              {pane.repo.name}
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
          <PaneAvatar pane={pane} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isClaudePane && session ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-xs px-1 py-0.5 rounded bg-rpg-accent/20 text-rpg-accent font-medium" title="Worker">W</span>
                  <span className="font-medium text-sm">{session.name}</span>
                </span>
              ) : (
                <span className="font-mono text-sm">{pane.process.command}</span>
              )}

              {pane.repo && <RepoStatusBar repo={pane.repo} compact />}

              <StatusIndicator status={status} onDismiss={handleDismiss} />
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
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
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
                <button
                  onClick={handleCloseClick}
                  className="w-8 h-8 flex items-center justify-center text-rpg-text-dim hover:text-rpg-error hover:bg-rpg-error/10 rounded transition-colors"
                  title="Close pane"
                >
                  ×
                </button>
                <button
                  onClick={handleRefresh}
                  className="w-8 h-8 flex items-center justify-center text-rpg-text-dim hover:text-rpg-accent hover:bg-rpg-accent/10 rounded transition-colors"
                  title="Refresh pane"
                >
                  ↻
                </button>
                <button
                  onClick={handleExpand}
                  className="w-8 h-8 flex items-center justify-center text-rpg-text-dim hover:text-rpg-accent hover:bg-rpg-accent/10 rounded transition-colors"
                  title="Full screen"
                >
                  ⛶
                </button>
              </>
            )}
            <span className="text-rpg-text-dim text-xs w-4 text-center">
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </div>
      </div>

      {/* Error details (Claude only) */}
      {isClaudePane && session?.status === 'error' && session.lastError && !session.pendingQuestion && (
        <div className="px-3 pb-3">
          <div className="p-3 bg-rpg-error/20 rounded border border-rpg-error/50">
            <p className="text-sm">
              <span className="font-medium">Tool:</span> {session.lastError.tool}
            </p>
            {session.lastError.message && (
              <p className="text-sm text-rpg-error mt-1">{session.lastError.message}</p>
            )}
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

          <TerminalDisplay content={terminalContent} />

          {/* Input section */}
          <div className="space-y-2">
            {isClaudePane && session?.terminalPrompt && (
              <TerminalPromptUI
                prompt={session.terminalPrompt}
                onAnswer={handleTerminalPromptAnswer}
                onCancel={handleCancelPrompt}
              />
            )}

            {isClaudePane && session?.pendingQuestion && !session?.terminalPrompt && (
              <QuestionInput
                pendingQuestion={session.pendingQuestion}
                onAnswer={handleAnswer}
                compact={true}
              />
            )}

            {!session?.terminalPrompt && !session?.pendingQuestion && (
              <PaneInput
                paneId={pane.id}
                pane={pane}
                onSendPrompt={onSendPrompt}
                onSendSignal={onSendSignal}
                variant="card"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  if (prev.compact !== next.compact) return false
  return paneEqual(prev.pane, next.pane)
})
