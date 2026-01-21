import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { TmuxPane, TmuxWindow } from '@shared/types'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { STATUS_LABELS, getStatusColor } from '../constants/status'
import { QuestionInput } from './QuestionInput'

// Detect if terminal is showing a password prompt
const PASSWORD_PATTERNS = [
  /\[sudo\] password for/i,
  /password:/i,
  /enter passphrase/i,
  /enter pin/i,
  /authentication required/i,
]

function isPasswordPrompt(terminalContent: string | undefined): boolean {
  if (!terminalContent) return false
  // Check last few lines for password prompt
  const lastLines = terminalContent.split('\n').slice(-5).join('\n')
  return PASSWORD_PATTERNS.some(pattern => pattern.test(lastLines))
}

interface FullScreenPaneProps {
  pane: TmuxPane
  window: TmuxWindow
  attentionCount: number
  onClose: () => void
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting: (paneId: string) => void
  proMode: boolean
}

export function FullScreenPane({
  pane,
  window,
  attentionCount,
  onClose,
  onSendPrompt,
  onSendSignal,
  onDismissWaiting,
  proMode,
}: FullScreenPaneProps) {
  const [inputValue, setInputValue] = useState('')
  const terminalContent = usePaneTerminal(pane.id)
  const terminalRef = useRef<HTMLPreElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect password prompt in terminal
  const isPassword = useMemo(() => isPasswordPrompt(terminalContent), [terminalContent])

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession

  const status: string = isClaudePane && session
    ? session.status
    : pane.process.typing ? 'typing' : pane.process.type

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
    if (inputRef.current && status !== 'working') {
      inputRef.current.focus()
    }
  }, [status])

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSendPrompt(pane.id, inputValue.trim())
      setInputValue('')
    }
  }, [onSendPrompt, pane.id, inputValue])

  const handleEnter = useCallback(() => {
    onSendPrompt(pane.id, '')
  }, [onSendPrompt, pane.id])

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
          proMode ? (
            <div className="w-10 h-10 rounded-full bg-rpg-accent/20 flex items-center justify-center text-lg font-bold flex-shrink-0">
              C
            </div>
          ) : session.avatarSvg ? (
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
              {isClaudePane && session ? (proMode ? 'Claude' : session.name) : pane.process.command}
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
        <pre
          ref={terminalRef}
          onClick={() => inputRef.current?.focus()}
          className="h-full bg-rpg-bg rounded-lg p-4 text-sm font-mono text-rpg-working overflow-auto whitespace-pre-wrap border border-rpg-border-dim cursor-text"
        >
          {terminalContent || <span className="text-rpg-text-dim">Waiting for activity...</span>}
        </pre>
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
          <div className="flex gap-2 items-center">
            {isPassword && <span className="text-rpg-waiting text-lg">🔒</span>}
            <input
              ref={inputRef}
              type={isPassword ? 'password' : 'text'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (inputValue.trim()) {
                    handleSend()
                  } else {
                    handleEnter()
                  }
                }
              }}
              placeholder={isPassword ? "Enter password..." : (isClaudePane ? "Send prompt..." : "Send input...")}
              className={`flex-1 px-4 py-3 text-base bg-rpg-bg border rounded-lg outline-none ${
                isPassword ? 'border-rpg-waiting/50 focus:border-rpg-waiting' : 'border-rpg-border focus:border-rpg-accent'
              }`}
              autoComplete={isPassword ? 'off' : undefined}
            />
            {!isPassword && (
              <button
                onClick={handleEnter}
                className="px-4 py-3 bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle rounded-lg transition-colors active:scale-95"
                title="Send Enter"
              >
                ⏎
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={`px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors active:scale-95 ${
                isPassword ? 'bg-rpg-waiting/30 hover:bg-rpg-waiting/50' : 'bg-rpg-accent/30 hover:bg-rpg-accent/50'
              }`}
            >
              Send
            </button>
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
}
