import { useEffect, useCallback, memo } from 'react'
import type { TmuxPane, TmuxWindow } from '@shared/types'
import { sendPromptToPane } from '../hooks/useWindows'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { useConfirmAction } from '../hooks/useConfirmAction'
import { getPaneStatus, paneEqual } from '../utils/pane-status'
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

interface FullScreenPaneProps {
  pane: TmuxPane
  window: TmuxWindow
  attentionCount: number
  onClose: () => void
}

export const FullScreenPane = memo(function FullScreenPane({
  pane,
  window,
  attentionCount,
  onClose,
}: FullScreenPaneProps) {
  const { onSendPrompt, onSendSignal, onDismissWaiting, onClosePane, rpgEnabled } = usePaneActions()
  const terminalContent = usePaneTerminal(pane.id)

  const closeConfirm = useConfirmAction(useCallback(() => {
    onClosePane(pane.id)
    onClose()
  }, [onClosePane, onClose, pane.id]))

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession
  const status = getPaneStatus(pane)

  // Handle Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDismissWaiting(pane.id)
  }, [onDismissWaiting, pane.id])

  const handleAnswer = useCallback((answer: string) => {
    onSendPrompt(pane.id, answer)
  }, [onSendPrompt, pane.id])

  // Handler for terminal-detected prompts (permissions use single keys)
  const handleTerminalPromptAnswer = useCallback((answer: string, isPermission?: boolean) => {
    sendPromptToPane(pane.id, answer, isPermission ? { isPermissionResponse: true } : undefined)
  }, [pane.id])

  const handleCancelPrompt = useCallback(() => {
    sendPromptToPane(pane.id, 'Escape')
  }, [pane.id])

  return (
    <div className="fixed inset-0 z-50 bg-rpg-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-rpg-border bg-rpg-card">
        {/* Close button */}
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-rpg-bg-elevated hover:bg-rpg-border transition-colors"
          title="Close (Escape)"
        >
          <span className="text-xl">←</span>
        </button>

        {/* Avatar */}
        <PaneAvatar pane={pane} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {isClaudePane && session ? session.name : pane.process.command}
            </span>
            {pane.repo && <RepoStatusBar repo={pane.repo} />}
          </div>
          <div className="text-sm text-rpg-text-muted">
            {isClaudePane && session ? (
              <ClaudeActivity session={session} />
            ) : (
              <>
                {window.sessionName}:{window.windowName}
                {pane.repo?.upstream && (
                  <span className="ml-2">
                    ↳ fork of {pane.repo.upstream.org}/{pane.repo.upstream.name}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pane close control */}
        <div className="flex items-center gap-1">
          {closeConfirm.confirming ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-rpg-error/20 rounded text-xs">
              <span className="text-rpg-error">Close?</span>
              <button
                onClick={closeConfirm.handleCancel}
                className="px-1.5 py-0.5 bg-rpg-idle/30 hover:bg-rpg-idle/50 rounded transition-colors"
              >
                No
              </button>
              <button
                onClick={closeConfirm.handleClick}
                className="px-1.5 py-0.5 bg-rpg-error/50 hover:bg-rpg-error/70 text-white rounded transition-colors"
              >
                Yes
              </button>
            </div>
          ) : (
            <button
              onClick={closeConfirm.handleClick}
              className="w-10 h-10 flex items-center justify-center text-rpg-text-dim hover:text-rpg-error hover:bg-rpg-error/10 rounded transition-colors"
              title="Close pane"
            >
              ×
            </button>
          )}
        </div>

        {/* Status */}
        <StatusIndicator status={status} onDismiss={handleDismiss} />

        {/* Attention badge for other panes */}
        {attentionCount > 0 && (
          <button
            onClick={onClose}
            className="px-2 py-1 rounded status-bg-waiting text-rpg-waiting text-sm font-medium animate-pulse"
            title="Other panes need attention"
          >
            {attentionCount} waiting
          </button>
        )}
      </header>

      {/* Feature sections below header */}
      <div className="px-4 pt-3 space-y-2">
        {pane.repo?.org && <GitHubLinks repo={pane.repo} />}
        {rpgEnabled && isClaudePane && session && (
          <SessionStatsBar stats={session.stats} />
        )}
      </div>

      {/* Terminal - takes remaining space */}
      <div className="flex-1 overflow-hidden p-4">
        <TerminalDisplay
          content={terminalContent}
          className="h-full bg-rpg-bg rounded-lg p-4 text-sm font-mono text-rpg-working overflow-auto whitespace-pre-wrap border border-rpg-border-dim cursor-text"
        />
      </div>

      {/* Input area - always at bottom */}
      <div className="px-4 py-3 border-t border-rpg-border bg-rpg-card space-y-2">
        {/* Terminal-detected prompt (source of truth) */}
        {isClaudePane && session?.terminalPrompt && (
          <TerminalPromptUI
            prompt={session.terminalPrompt}
            onAnswer={handleTerminalPromptAnswer}
            onCancel={handleCancelPrompt}
          />
        )}

        {/* Legacy pending question input (fallback when no terminal prompt) */}
        {isClaudePane && session?.pendingQuestion && !session?.terminalPrompt && (
          <QuestionInput
            pendingQuestion={session.pendingQuestion}
            onAnswer={handleAnswer}
          />
        )}

        {/* Regular input (when no prompt active) */}
        {!session?.terminalPrompt && !session?.pendingQuestion && (
          <PaneInput
            paneId={pane.id}
            pane={pane}
            onSendPrompt={onSendPrompt}
            onSendSignal={onSendSignal}
            variant="fullscreen"
          />
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  if (prev.attentionCount !== next.attentionCount) return false
  if (prev.window.id !== next.window.id) return false
  return paneEqual(prev.pane, next.pane)
})
