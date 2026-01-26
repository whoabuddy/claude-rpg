import { useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { ansiToHtml } from '../utils/ansi'
import type { TmuxPane, TmuxWindow } from '@shared/types'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { usePaneSend } from '../hooks/usePaneSend'
import { useConfirmAction } from '../hooks/useConfirmAction'
import { getPaneStatus, paneEqual } from '../utils/pane-status'
import { STATUS_LABELS, getStatusColor } from '../constants/status'
import { QuestionInput } from './QuestionInput'
import { isPasswordPrompt } from '../utils/password-detection'

interface FullScreenPaneProps {
  pane: TmuxPane
  window: TmuxWindow
  attentionCount: number
  onClose: () => void
  onSendPrompt: (paneId: string, prompt: string) => Promise<{ ok: boolean; error?: string }>
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting: (paneId: string) => void
  onClosePane?: (paneId: string) => void
}

export const FullScreenPane = memo(function FullScreenPane({
  pane,
  window,
  attentionCount,
  onClose,
  onSendPrompt,
  onSendSignal,
  onDismissWaiting,
  onClosePane,
}: FullScreenPaneProps) {
  const terminalContent = usePaneTerminal(pane.id)
  const terminalRef = useRef<HTMLDivElement>(null)

  // Shared hooks
  const send = usePaneSend(pane.id, onSendPrompt)
  const closeConfirm = useConfirmAction(useCallback(() => {
    onClosePane?.(pane.id)
    onClose()
  }, [onClosePane, onClose, pane.id]))

  // Detect password prompt in terminal
  const isPassword = useMemo(() => isPasswordPrompt(terminalContent), [terminalContent])

  // Convert ANSI to HTML
  const htmlContent = useMemo(() => terminalContent ? ansiToHtml(terminalContent) : null, [terminalContent])

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession
  const status = getPaneStatus(pane)

  const statusLabel = STATUS_LABELS[status] || status
  const statusColor = getStatusColor(status)

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

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalContent])

  // Focus input on mount
  useEffect(() => {
    if (send.inputRef.current && status !== 'working') {
      send.inputRef.current.focus()
    }
  }, [status, send.inputRef])

  const handleCtrlC = useCallback(() => {
    onSendSignal(pane.id, 'SIGINT')
  }, [onSendSignal, pane.id])

  const handleDismiss = useCallback(() => {
    onDismissWaiting(pane.id)
  }, [onDismissWaiting, pane.id])

  const handleAnswer = useCallback((answer: string) => {
    onSendPrompt(pane.id, answer)
  }, [onSendPrompt, pane.id])

  const showInput = status !== 'working'
  const showCtrlC = status === 'working' || pane.process.type === 'process'

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
        {isClaudePane && session ? (
          session.avatarSvg ? (
            <div
              className="w-10 h-10 rounded-full overflow-hidden bg-rpg-bg flex-shrink-0"
              dangerouslySetInnerHTML={{ __html: session.avatarSvg }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-rpg-accent/30 flex items-center justify-center text-lg font-bold flex-shrink-0">
              {session.name[0]}
            </div>
          )
        ) : (
          <div className="w-10 h-10 rounded-full bg-rpg-bg-elevated flex items-center justify-center text-lg font-mono flex-shrink-0 text-rpg-text-muted">
            {pane.process.type === 'shell' ? '$' : '>'}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {isClaudePane && session ? session.name : pane.process.command}
            </span>
            {pane.repo && (
              <div className="flex items-center gap-1.5 text-sm truncate">
                <span className="text-rpg-accent">
                  {pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name}
                </span>
                {pane.repo.branch && (
                  <>
                    <span className="text-rpg-text-dim">:</span>
                    <span className="text-rpg-working">{pane.repo.branch}</span>
                  </>
                )}
                {(pane.repo.ahead !== undefined && pane.repo.ahead > 0) && (
                  <span className="text-rpg-success">↑{pane.repo.ahead}</span>
                )}
                {(pane.repo.behind !== undefined && pane.repo.behind > 0) && (
                  <span className="text-rpg-error">↓{pane.repo.behind}</span>
                )}
                {pane.repo.isDirty && (
                  <span className="text-rpg-waiting">●</span>
                )}
              </div>
            )}
          </div>
          <div className="text-sm text-rpg-text-muted">
            {window.sessionName}:{window.windowName}
            {pane.repo?.upstream && (
              <span className="ml-2">
                ↳ fork of {pane.repo.upstream.org}/{pane.repo.upstream.name}
              </span>
            )}
          </div>
        </div>

        {/* Pane close control */}
        {onClosePane && (
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
        )}

        {/* Status */}
        <div className="flex items-center gap-2">
          {status === 'waiting' && (
            <button
              onClick={handleDismiss}
              className="px-2 py-1 text-xs bg-rpg-idle/30 hover:bg-rpg-idle/50 text-rpg-text-muted rounded transition-colors"
              title="Dismiss waiting"
            >
              ✓
            </button>
          )}
          <span className="text-sm text-rpg-text-muted">{statusLabel}</span>
          <div className={`w-3 h-3 rounded-full ${statusColor} ${
            status === 'working' || status === 'typing' || status === 'process' ? 'animate-pulse' : ''
          }`} />
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

      {/* Terminal - takes remaining space */}
      <div className="flex-1 overflow-hidden p-4">
        <div
          ref={terminalRef}
          onClick={() => send.inputRef.current?.focus()}
          className="h-full bg-rpg-bg rounded-lg p-4 text-sm font-mono text-rpg-working overflow-auto whitespace-pre-wrap border border-rpg-border-dim cursor-text"
        >
          {htmlContent ? (
            <pre className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: htmlContent }} />
          ) : (
            <pre className="whitespace-pre-wrap"><span className="text-rpg-text-dim">Waiting for activity...</span></pre>
          )}
        </div>
      </div>

      {/* Input area - always at bottom */}
      <div className="px-4 py-3 border-t border-rpg-border bg-rpg-card">
        {/* Pending question input */}
        {isClaudePane && session?.pendingQuestion && (
          <QuestionInput
            pendingQuestion={session.pendingQuestion}
            onAnswer={handleAnswer}
          />
        )}

        {/* Regular input (when no pending question) */}
        {showInput && !session?.pendingQuestion && (
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              {isPassword && <span className="text-rpg-waiting text-lg">🔒</span>}
              <input
                ref={send.inputRef as React.RefObject<HTMLInputElement>}
                type={isPassword ? 'password' : 'text'}
                value={send.inputValue}
                onChange={(e) => send.setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (send.inputValue.trim()) {
                      send.handleSend()
                    } else {
                      send.handleEnter()
                    }
                  }
                }}
                disabled={send.isSending}
                placeholder={isPassword ? "Enter password..." : (isClaudePane ? "Send prompt..." : "Send input...")}
                className={`flex-1 px-4 py-3 text-base bg-rpg-bg border rounded-lg outline-none ${
                  isPassword ? 'border-rpg-waiting/50 focus:border-rpg-waiting' : 'border-rpg-border focus:border-rpg-accent'
                } ${send.isSending ? 'opacity-50' : ''}`}
                autoComplete={isPassword ? 'off' : undefined}
              />
              {!isPassword && (
                <button
                  onClick={send.handleEnter}
                  disabled={send.isSending}
                  className={`px-4 py-3 bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle rounded-lg transition-colors active:scale-95 ${send.isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Send Enter"
                >
                  ⏎
                </button>
              )}
              <button
                onClick={send.handleSend}
                disabled={!send.inputValue.trim() || send.isSending}
                className={`px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors active:scale-95 ${
                  isPassword ? 'bg-rpg-waiting/30 hover:bg-rpg-waiting/50' : 'bg-rpg-accent/30 hover:bg-rpg-accent/50'
                }`}
              >
                {send.isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!send.isSending && !send.inputValue && send.hasLastPrompt && (
                <button
                  onClick={send.handleRestoreLast}
                  className="px-2 py-1 text-xs text-rpg-text-muted hover:text-rpg-accent transition-colors"
                  title="Restore last sent prompt"
                >
                  ↩ Restore last
                </button>
              )}
              {send.inlineError && (
                <div className="flex items-center gap-2 px-3 py-1 bg-rpg-error/20 border border-rpg-error/50 rounded text-sm text-rpg-error">
                  <span>{send.inlineError}</span>
                  <button
                    onClick={send.clearInlineError}
                    className="text-rpg-error/60 hover:text-rpg-error text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interrupt button (when working) */}
        {showCtrlC && (
          <div className="flex">
            <button
              onClick={handleCtrlC}
              className="px-6 py-3 bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error rounded-lg transition-colors active:scale-95 ml-auto"
            >
              Interrupt
            </button>
          </div>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  if (prev.attentionCount !== next.attentionCount) return false
  if (prev.window.id !== next.window.id) return false
  return paneEqual(prev.pane, next.pane)
})
