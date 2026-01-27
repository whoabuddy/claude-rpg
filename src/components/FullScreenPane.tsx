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
import { ActionButton } from './ActionButton'

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
        {/* Back button */}
        <ActionButton icon="←" label="Back" variant="ghost" onClick={onClose} title="Close (Escape)" />

        {/* Avatar */}
        <PaneAvatar pane={pane} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {pane.repo ? (
              <>
                <RepoStatusBar repo={pane.repo} />
                {isClaudePane && session && (
                  <span className="text-sm text-rpg-text-muted">&middot; {session.name}</span>
                )}
              </>
            ) : (
              <span className="font-medium">
                {isClaudePane && session ? session.name : pane.process.command}
              </span>
            )}
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

        {/* Status + Pane close control — aligned together */}
        <div className="flex items-center gap-1">
          <StatusIndicator status={status} onDismiss={handleDismiss} />
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
            <ActionButton icon="×" label="Close Pane" variant="danger" onClick={closeConfirm.handleClick} iconOnly />
          )}
        </div>

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

      {/* Terminal - takes remaining space, with prompt overlays */}
      <div className="flex-1 overflow-hidden p-4 relative">
        <TerminalDisplay
          content={terminalContent}
          className="h-full bg-rpg-bg rounded-lg p-4 text-sm font-mono text-rpg-working overflow-auto whitespace-pre-wrap border border-rpg-border-dim cursor-text"
        />

        {/* Prompt overlays on terminal area */}
        {isClaudePane && session?.terminalPrompt && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-rpg-bg/95 backdrop-blur-sm rounded-lg border border-rpg-border shadow-lg">
            <TerminalPromptUI
              prompt={session.terminalPrompt}
              onAnswer={handleTerminalPromptAnswer}
              onCancel={handleCancelPrompt}
            />
          </div>
        )}

        {isClaudePane && session?.pendingQuestion && !session?.terminalPrompt && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-rpg-bg/95 backdrop-blur-sm rounded-lg border border-rpg-border shadow-lg">
            <QuestionInput
              pendingQuestion={session.pendingQuestion}
              onAnswer={handleAnswer}
            />
          </div>
        )}
      </div>

      {/* Input area - always at bottom */}
      <div className="px-4 py-3 border-t border-rpg-border bg-rpg-card">
        <PaneInput
          paneId={pane.id}
          pane={pane}
          onSendPrompt={onSendPrompt}
          onSendSignal={onSendSignal}
          variant="fullscreen"
        />
      </div>
    </div>
  )
}, (prev, next) => {
  if (prev.attentionCount !== next.attentionCount) return false
  if (prev.window.id !== next.window.id) return false
  return paneEqual(prev.pane, next.pane)
})
