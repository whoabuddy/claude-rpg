import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react'
import type { TmuxPane, TmuxWindow, ClaudeSessionInfo, RepoInfo, SessionStats, TerminalPrompt, PaneError } from '@shared/types'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { ansiToHtml } from '../utils/ansi'
import { STATUS_LABELS, STATUS_THEME } from '../constants/status'
import { QuestionInput } from './QuestionInput'
import { VoiceButton } from './VoiceButton'
import { isPasswordPrompt } from '../utils/password-detection'
import { lastPromptByPane } from '../utils/prompt-history'

// Use same-origin requests (proxied by Vite in dev, same server in prod)
const API_BASE = ''

interface PaneCardProps {
  pane: TmuxPane
  window: TmuxWindow
  rpgEnabled?: boolean
  onSendPrompt: (paneId: string, prompt: string) => Promise<{ ok: boolean; error?: string }>
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting?: (paneId: string) => void
  onExpandPane?: (paneId: string) => void
  onRefreshPane?: (paneId: string) => void
  onClosePane?: (paneId: string) => void
  compact?: boolean
}

export const PaneCard = memo(function PaneCard({ pane, window, rpgEnabled = true, onSendPrompt, onSendSignal, onDismissWaiting, onExpandPane, onRefreshPane, onClosePane, compact = false }: PaneCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const terminalContent = usePaneTerminal(pane.id)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect password prompt in terminal
  const isPassword = useMemo(() => isPasswordPrompt(terminalContent), [terminalContent])

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession

  // Determine status for theming
  const status: string = isClaudePane && session
    ? session.status
    : pane.process.typing ? 'typing' : pane.process.type

  const theme = STATUS_THEME[status as keyof typeof STATUS_THEME] || STATUS_THEME.idle
  const statusLabel = STATUS_LABELS[status] || status

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])
  const prevExpandedRef = useRef(expanded)

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || isSending) return
    setIsSending(true)
    setInlineError(null)
    const result = await onSendPrompt(pane.id, trimmed)
    if (result.ok) {
      lastPromptByPane.set(pane.id, trimmed)
      setInputValue('')
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
      }
    } else {
      setInlineError(result.error || 'Failed to send')
      setTimeout(() => setInlineError(null), 5000)
    }
    setIsSending(false)
  }, [onSendPrompt, pane.id, inputValue, isSending])

  const handleRestoreLast = useCallback(() => {
    const last = lastPromptByPane.get(pane.id)
    if (last) setInputValue(last)
  }, [pane.id])

  const handleCtrlC = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSendSignal(pane.id, 'SIGINT')
  }, [onSendSignal, pane.id])

  const handleAnswer = useCallback((answer: string) => {
    onSendPrompt(pane.id, answer)
  }, [onSendPrompt, pane.id])

  // Handler for terminal-detected prompts (permissions use single keys)
  const handleTerminalPromptAnswer = useCallback(async (answer: string, isPermission?: boolean) => {
    // For permissions, we need to signal that this is a single-key response
    // The server will send just the key without Enter
    try {
      const res = await fetch(`${API_BASE}/api/panes/${encodeURIComponent(pane.id)}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: answer,
          ...(isPermission && { isPermissionResponse: true }),
        }),
      })
      if (!res.ok) {
        console.error('[PaneCard] Prompt failed:', res.status, await res.text())
      }
    } catch (e) {
      console.error('[PaneCard] Prompt error:', e)
    }
  }, [pane.id])

  const handleCancelPrompt = useCallback(async () => {
    // Send Escape to cancel the prompt
    try {
      const res = await fetch(`${API_BASE}/api/panes/${encodeURIComponent(pane.id)}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Escape' }),
      })
      if (!res.ok) {
        console.error('[PaneCard] Cancel failed:', res.status, await res.text())
      }
    } catch (e) {
      console.error('[PaneCard] Cancel error:', e)
    }
  }, [pane.id])

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDismissWaiting?.(pane.id)
  }, [onDismissWaiting, pane.id])

  const handleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onExpandPane?.(pane.id)
  }, [onExpandPane, pane.id])

  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onRefreshPane?.(pane.id)
  }, [onRefreshPane, pane.id])

  const handleCloseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmClose) {
      // Already confirming, execute close
      onClosePane?.(pane.id)
      setConfirmClose(false)
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    } else {
      // Show confirmation
      setConfirmClose(true)
      // Auto-dismiss after 3s
      closeTimeoutRef.current = setTimeout(() => {
        setConfirmClose(false)
        closeTimeoutRef.current = null
      }, 3000)
    }
  }, [confirmClose, onClosePane, pane.id])

  const handleCancelClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmClose(false)
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Listen for pane_error events matching this pane
  useEffect(() => {
    const handlePaneError = (e: CustomEvent<PaneError>) => {
      if (e.detail.paneId === pane.id) {
        setInlineError(e.detail.message)
        // Auto-dismiss after 5 seconds
        setTimeout(() => setInlineError(null), 5000)
      }
    }
    globalThis.addEventListener('pane_error', handlePaneError as EventListener)
    return () => globalThis.removeEventListener('pane_error', handlePaneError as EventListener)
  }, [pane.id])

  const handleVoiceTranscription = useCallback((text: string) => {
    // Append transcribed text to input
    setInputValue(prev => prev ? `${prev} ${text}` : text)
    // Focus the input so user can edit/send
    inputRef.current?.focus()
  }, [])

  // Show input when: expanded AND (Claude not actively working OR non-Claude pane)
  // Allow input for idle, waiting, typing, error - only hide when working
  const showInput = expanded && (
    (isClaudePane && session?.status !== 'working') ||
    !isClaudePane
  )

  // Show Ctrl+C when: expanded AND (working Claude OR running process)
  const showCtrlC = expanded && (
    (isClaudePane && session?.status === 'working') ||
    (pane.process.type === 'process')
  )

  // Auto-focus input only when user expands the pane (not when status changes)
  useEffect(() => {
    const justExpanded = expanded && !prevExpandedRef.current
    prevExpandedRef.current = expanded

    if (justExpanded && showInput) {
      if (isPassword) {
        passwordInputRef.current?.focus()
      } else {
        inputRef.current?.focus()
      }
    }
  }, [expanded, showInput, isPassword])

  // Compact mode: simpler display for idle panes
  if (compact && !expanded) {
    return (
      <div
        className={`rounded-lg border ${theme.border} bg-rpg-card card-interactive cursor-pointer hover:border-rpg-accent`}
        onClick={toggleExpanded}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          {/* Minimal icon */}
          {isClaudePane && session ? (
            <div className="w-6 h-6 rounded bg-rpg-accent/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
              C
            </div>
          ) : (
            <div className="w-6 h-6 rounded bg-rpg-bg-elevated flex items-center justify-center text-xs font-mono flex-shrink-0 text-rpg-text-muted">
              $
            </div>
          )}

          {/* Name */}
          <span className="text-sm text-rpg-text-muted truncate">
            {isClaudePane && session ? session.name : pane.process.command}
          </span>

          {/* Repo badge */}
          {pane.repo && (
            <span className="text-xs text-rpg-accent-dim truncate">
              {pane.repo.name}
            </span>
          )}

          {/* Status indicator - aligned right */}
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
          {/* Avatar/Icon */}
          {isClaudePane && session ? (
            session.avatarSvg ? (
              <div
                className="w-10 h-10 rounded-full overflow-hidden bg-rpg-bg flex-shrink-0"
                dangerouslySetInnerHTML={{ __html: session.avatarSvg }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-rpg-accent/30 flex items-center justify-center text-base font-bold flex-shrink-0">
                {session.name[0]}
              </div>
            )
          ) : (
            <div className={`w-8 h-8 rounded bg-rpg-bg-elevated flex items-center justify-center text-sm font-mono flex-shrink-0 ${pane.process.typing ? 'text-rpg-accent' : 'text-rpg-text-muted'}`}>
              {pane.process.type === 'shell' ? '$' : '>'}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {/* Name/Command with Worker badge for Claude */}
              {isClaudePane && session ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-xs px-1 py-0.5 rounded bg-rpg-accent/20 text-rpg-accent font-medium" title="Worker">W</span>
                  <span className="font-medium text-sm">{session.name}</span>
                </span>
              ) : (
                <span className="font-mono text-sm">{pane.process.command}</span>
              )}

              {/* Repo + Git Status */}
              {pane.repo && (
                <div className="flex items-center gap-1.5 text-xs truncate">
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
                    <span className="text-rpg-success" title={`${pane.repo.ahead} ahead`}>↑{pane.repo.ahead}</span>
                  )}
                  {(pane.repo.behind !== undefined && pane.repo.behind > 0) && (
                    <span className="text-rpg-error" title={`${pane.repo.behind} behind`}>↓{pane.repo.behind}</span>
                  )}
                  {pane.repo.isDirty && (
                    <span className="text-rpg-waiting" title="Uncommitted changes">●</span>
                  )}
                </div>
              )}

              {/* Status indicator */}
              <div className="flex items-center gap-1.5 ml-auto">
                {/* Dismiss button for waiting status - on left */}
                {status === 'waiting' && onDismissWaiting && (
                  <button
                    onClick={handleDismiss}
                    className="px-1.5 py-0.5 text-xs bg-rpg-idle/30 hover:bg-rpg-idle/50 text-rpg-text-muted rounded transition-colors"
                    title="Dismiss - Claude is waiting for you to type"
                  >
                    ✓
                  </button>
                )}
                <span className="text-xs text-rpg-text-muted">{statusLabel}</span>
                <div className={`w-2 h-2 rounded-full ${theme.indicator} ${
                  status === 'working' || status === 'typing' || status === 'process' ? 'animate-pulse' : ''
                }`} />
              </div>
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
            {/* Close confirmation inline */}
            {confirmClose ? (
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
                {onClosePane && (
                  <button
                    onClick={handleCloseClick}
                    className="w-8 h-8 flex items-center justify-center text-rpg-text-dim hover:text-rpg-error hover:bg-rpg-error/10 rounded transition-colors"
                    title="Close pane"
                  >
                    ×
                  </button>
                )}
                {onRefreshPane && (
                  <button
                    onClick={handleRefresh}
                    className="w-8 h-8 flex items-center justify-center text-rpg-text-dim hover:text-rpg-accent hover:bg-rpg-accent/10 rounded transition-colors"
                    title="Refresh pane"
                  >
                    ↻
                  </button>
                )}
                {onExpandPane && (
                  <button
                    onClick={handleExpand}
                    className="w-8 h-8 flex items-center justify-center text-rpg-text-dim hover:text-rpg-accent hover:bg-rpg-accent/10 rounded transition-colors"
                    title="Full screen"
                  >
                    ⛶
                  </button>
                )}
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
          {/* Pane management - visible on mobile only when expanded */}
          {/* Fork info + GitHub Links */}
          {pane.repo?.org && (
            <GitHubLinks repo={pane.repo} />
          )}

          {/* Session stats bar for Claude sessions */}
          {rpgEnabled && isClaudePane && session && (
            <SessionStatsBar stats={session.stats} />
          )}

          {/* Terminal */}
          <ExpandedTerminal content={terminalContent} onTerminalClick={() => {
            if (isPassword) {
              passwordInputRef.current?.focus()
            } else {
              inputRef.current?.focus()
            }
          }} />

          {/* Input section - always at bottom */}
          <div className="space-y-2">
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
                compact={true}
              />
            )}

            {/* Regular input (when no prompt active) */}
            {showInput && !session?.terminalPrompt && !session?.pendingQuestion && (
              <>
                {isPassword ? (
                  /* Password input - masked */
                  <div className="flex gap-2 items-center">
                    <span className="text-rpg-waiting text-sm">🔒</span>
                    <input
                      ref={passwordInputRef}
                      type="password"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSend()
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isSending}
                      placeholder="Enter password..."
                      className={`flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-waiting/50 rounded focus:border-rpg-waiting outline-none min-h-[44px] ${isSending ? 'opacity-50' : ''}`}
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  /* Regular textarea input */
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value)
                        // Auto-resize textarea
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          e.stopPropagation()
                          if (inputValue.trim()) {
                            handleSend()
                          } else {
                            onSendPrompt(pane.id, '') // Just Enter - fire-and-forget
                          }
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isSending}
                      placeholder={isClaudePane ? "Send prompt... (Shift+Enter for newline)" : "Send input..."}
                      className={`flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none min-h-[44px] max-h-[200px] resize-none ${isSending ? 'opacity-50' : ''}`}
                      rows={1}
                    />
                    <VoiceButton onTranscription={handleVoiceTranscription} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (inputValue.trim()) {
                        handleSend()
                      } else {
                        onSendPrompt(pane.id, '') // Just Enter - fire-and-forget
                      }
                    }}
                    disabled={isSending}
                    className={`flex-1 sm:flex-none px-4 py-2 text-sm rounded transition-colors active:scale-95 min-h-[44px] ${
                      isSending
                        ? 'bg-rpg-accent/20 text-rpg-text-muted cursor-not-allowed'
                        : inputValue.trim()
                          ? isPassword ? 'bg-rpg-waiting/30 hover:bg-rpg-waiting/50' : 'bg-rpg-accent/30 hover:bg-rpg-accent/50'
                          : 'bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle'
                    }`}
                    title={inputValue.trim() ? "Send message" : "Send Enter (accept suggestion)"}
                  >
                    {isSending ? 'Sending...' : inputValue.trim() ? 'Send' : '⏎ Enter'}
                  </button>
                  {!isSending && !inputValue && lastPromptByPane.has(pane.id) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestoreLast() }}
                      className="px-2 py-1 text-xs text-rpg-text-muted hover:text-rpg-accent transition-colors"
                      title="Restore last sent prompt"
                    >
                      ↩ Restore last
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Interrupt button (when working) */}
            {showCtrlC && (
              <button
                onClick={handleCtrlC}
                className="w-full sm:w-auto px-4 py-2 text-sm bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error rounded transition-colors active:scale-95 min-h-[44px]"
              >
                Interrupt
              </button>
            )}

            {/* Inline error banner */}
            {inlineError && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-rpg-error/20 border border-rpg-error/50 rounded text-sm text-rpg-error">
                <span>{inlineError}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setInlineError(null) }}
                  className="text-rpg-error/60 hover:text-rpg-error text-xs px-1"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  // Custom comparison - only re-render when visible state changes
  if (prev.compact !== next.compact) return false
  if (prev.pane.id !== next.pane.id) return false
  if (prev.pane.process.type !== next.pane.process.type) return false
  if (prev.pane.process.typing !== next.pane.process.typing) return false
  if (prev.pane.process.command !== next.pane.process.command) return false
  if (prev.pane.cwd !== next.pane.cwd) return false
  // Compare Claude session
  const sa = prev.pane.process.claudeSession
  const sb = next.pane.process.claudeSession
  if (!!sa !== !!sb) return false
  if (sa && sb) {
    if (sa.status !== sb.status) return false
    if (sa.name !== sb.name) return false
    if (sa.avatarSvg !== sb.avatarSvg) return false
    if (sa.currentTool !== sb.currentTool) return false
    if (sa.currentFile !== sb.currentFile) return false
    if (sa.lastPrompt !== sb.lastPrompt) return false
    if (!!sa.pendingQuestion !== !!sb.pendingQuestion) return false
    if (sa.pendingQuestion?.toolUseId !== sb.pendingQuestion?.toolUseId) return false
    // Compare terminal prompt (source of truth)
    if (!!sa.terminalPrompt !== !!sb.terminalPrompt) return false
    if (sa.terminalPrompt?.contentHash !== sb.terminalPrompt?.contentHash) return false
    if (sa.lastError?.timestamp !== sb.lastError?.timestamp) return false
    // Compare session stats (for re-rendering when stats change)
    if (sa.stats?.totalXPGained !== sb.stats?.totalXPGained) return false
  }
  // Compare repo
  if (prev.pane.repo?.name !== next.pane.repo?.name) return false
  if (prev.pane.repo?.org !== next.pane.repo?.org) return false
  return true
})

// Claude activity display
const ClaudeActivity = memo(function ClaudeActivity({ session }: { session: ClaudeSessionInfo }) {
  // Show last prompt if it has actual content (not empty/whitespace)
  if (session.lastPrompt && session.lastPrompt.trim()) {
    return <span><span className="text-rpg-text-dim">Prompt:</span> {session.lastPrompt}</span>
  }
  if (session.currentTool) {
    return (
      <span className="text-rpg-text-muted">
        {session.currentTool}
        {session.currentFile && `: ${session.currentFile.split('/').pop()}`}
      </span>
    )
  }
  if (session.status === 'waiting') {
    return <span className="text-rpg-waiting">Waiting for input...</span>
  }
  if (session.status === 'error' && session.lastError) {
    return <span className="text-rpg-error">Error in {session.lastError.tool}</span>
  }
  return <span className="text-rpg-text-dim">Ready</span>
})

// GitHub quick links
const GitHubLinks = memo(function GitHubLinks({ repo }: { repo: RepoInfo }) {
  if (!repo.org) return null

  const baseUrl = `https://github.com/${repo.org}/${repo.name}`

  const links = [
    { label: 'Repo', url: baseUrl, icon: '📁' },
    { label: 'Issues', url: `${baseUrl}/issues`, icon: '🐛' },
    { label: 'PRs', url: `${baseUrl}/pulls`, icon: '🔀' },
  ]

  // Add "Create PR" if on a non-default branch
  if (repo.branch && repo.defaultBranch && repo.branch !== repo.defaultBranch) {
    links.push({
      label: 'New PR',
      url: `${baseUrl}/compare/${repo.defaultBranch}...${repo.branch}?expand=1`,
      icon: '➕',
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Fork info */}
      {repo.upstream && (
        <span className="text-xs text-rpg-text-muted">
          ↳ fork of{' '}
          <a
            href={`https://github.com/${repo.upstream.org}/${repo.upstream.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rpg-accent hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {repo.upstream.org}/{repo.upstream.name}
          </a>
        </span>
      )}

      {/* Quick links - mobile-friendly with labels and larger touch targets */}
      <div className="flex flex-wrap gap-2">
        {links.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-rpg-bg-elevated hover:bg-rpg-border rounded transition-colors min-h-[44px]"
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
})

// Expanded terminal view
const ExpandedTerminal = memo(function ExpandedTerminal({ content, onTerminalClick }: { content: string | undefined, onTerminalClick?: () => void }) {
  const terminalRef = useRef<HTMLDivElement>(null)

  const htmlContent = useMemo(() => content ? ansiToHtml(content) : null, [content])

  useEffect(() => {
    if (!terminalRef.current) return
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    })
  }, [content])

  return (
    <div
      ref={terminalRef}
      onClick={onTerminalClick}
      className="bg-rpg-bg rounded p-3 text-xs font-mono text-rpg-working overflow-auto max-h-64 whitespace-pre-wrap border border-rpg-border-dim cursor-text"
    >
      {htmlContent ? (
        <pre className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      ) : (
        <pre className="whitespace-pre-wrap"><span className="text-rpg-text-dim">Waiting for activity...</span></pre>
      )}
    </div>
  )
})

// Session stats bar - shows XP and activity for current session
const SessionStatsBar = memo(function SessionStatsBar({ stats }: { stats: SessionStats | undefined }) {
  if (!stats || stats.totalXPGained === 0) return null

  // Calculate total tools used
  const totalTools = Object.values(stats.toolsUsed).reduce((sum, count) => sum + count, 0)

  const parts: string[] = []
  parts.push(`+${stats.totalXPGained} XP`)
  if (totalTools > 0) parts.push(`${totalTools} tools`)
  if (stats.git.commits > 0) parts.push(`${stats.git.commits} commit${stats.git.commits > 1 ? 's' : ''}`)
  if (stats.git.prsCreated > 0) parts.push(`${stats.git.prsCreated} PR${stats.git.prsCreated > 1 ? 's' : ''}`)
  if (stats.commands.testsRun > 0) parts.push(`${stats.commands.testsRun} test${stats.commands.testsRun > 1 ? 's' : ''}`)

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-rpg-accent/10 rounded text-xs text-rpg-accent">
      <span className="text-rpg-text-dim">This session:</span>
      <span className="font-mono">{parts.join(' | ')}</span>
    </div>
  )
})

// Terminal-detected prompt UI (source of truth for prompts)
interface TerminalPromptUIProps {
  prompt: TerminalPrompt
  onAnswer: (answer: string, isPermission?: boolean) => void
  onCancel: () => void
}

const TerminalPromptUI = memo(function TerminalPromptUI({ prompt, onAnswer, onCancel }: TerminalPromptUIProps) {
  const isPermission = prompt.type === 'permission'
  const isPlan = prompt.type === 'plan'

  // Different styling based on prompt type
  const bgColor = isPermission ? 'bg-rpg-waiting/10' : isPlan ? 'bg-rpg-accent/10' : 'bg-rpg-bg-elevated'
  const borderColor = isPermission ? 'border-rpg-waiting/50' : isPlan ? 'border-rpg-accent/50' : 'border-rpg-border'

  return (
    <div className={`p-3 rounded border ${borderColor} ${bgColor} space-y-3`}>
      {/* Header with tool name for permissions */}
      {isPermission && prompt.tool && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-rpg-waiting/20 text-rpg-waiting rounded">
            {prompt.tool}
          </span>
          {prompt.command && (
            <code className="text-xs text-rpg-text-muted font-mono truncate flex-1">
              {prompt.command.length > 60 ? prompt.command.slice(0, 60) + '...' : prompt.command}
            </code>
          )}
        </div>
      )}

      {/* Plan badge */}
      {isPlan && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-rpg-accent/20 text-rpg-accent rounded">
            Plan Approval
          </span>
        </div>
      )}

      {/* Question text */}
      <p className="text-sm font-medium">{prompt.question}</p>

      {/* Options */}
      <div className={`flex flex-wrap gap-2 ${isPermission ? '' : 'flex-col'}`}>
        {prompt.options.map((option) => {
          // Permission prompts: inline buttons with key hints
          if (isPermission) {
            // Highlight Allow (y) and Deny (n) prominently
            const isAllow = option.key === 'y'
            const isDeny = option.key === 'n'
            const btnClass = isAllow
              ? 'bg-rpg-success/20 hover:bg-rpg-success/40 text-rpg-success border-rpg-success/50'
              : isDeny
              ? 'bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error border-rpg-error/50'
              : 'bg-rpg-bg hover:bg-rpg-border text-rpg-text-muted border-rpg-border'

            return (
              <button
                key={option.key}
                onClick={() => onAnswer(option.key, true)}
                className={`px-3 py-2 text-sm rounded border transition-colors min-h-[44px] ${btnClass}`}
              >
                <span className="font-mono text-xs mr-1.5 opacity-60">[{option.key}]</span>
                {option.label}
              </button>
            )
          }

          // Question/Plan prompts: vertical list with numbers
          return (
            <button
              key={option.key}
              onClick={() => onAnswer(option.key)}
              className="flex items-start gap-2 px-3 py-2 text-sm text-left bg-rpg-bg hover:bg-rpg-border rounded border border-rpg-border transition-colors min-h-[44px]"
            >
              <span className="font-mono text-rpg-accent shrink-0">({option.key})</span>
              <span className="text-rpg-text">{option.label}</span>
            </button>
          )
        })}
      </div>

      {/* Footer with cancel hint */}
      {prompt.footer && (
        <div className="flex items-center justify-between text-xs text-rpg-text-dim">
          <span>{prompt.footer}</span>
          <button
            onClick={onCancel}
            className="px-2 py-1 hover:bg-rpg-error/20 hover:text-rpg-error rounded transition-colors"
          >
            Cancel (Esc)
          </button>
        </div>
      )}
    </div>
  )
})
