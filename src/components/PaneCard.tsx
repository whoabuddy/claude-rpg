import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react'
import type { TmuxPane, TmuxWindow, ClaudeSessionInfo, RepoInfo, SessionStats } from '@shared/types'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { STATUS_LABELS, STATUS_THEME } from '../constants/status'
import { QuestionInput } from './QuestionInput'
import { VoiceButton } from './VoiceButton'

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

interface PaneCardProps {
  pane: TmuxPane
  window: TmuxWindow
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting?: (paneId: string) => void
  onExpandPane?: (paneId: string) => void
  onRefreshPane?: (paneId: string) => void
  proMode?: boolean
  compact?: boolean
}

export const PaneCard = memo(function PaneCard({ pane, window, onSendPrompt, onSendSignal, onDismissWaiting, onExpandPane, onRefreshPane, proMode = false, compact = false }: PaneCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const terminalContent = usePaneTerminal(pane.id)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

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

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSendPrompt(pane.id, inputValue.trim())
      setInputValue('')
    }
  }, [onSendPrompt, pane.id, inputValue])

  const handleCtrlC = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSendSignal(pane.id, 'SIGINT')
  }, [onSendSignal, pane.id])

  const handleAnswer = useCallback((answer: string) => {
    onSendPrompt(pane.id, answer)
  }, [onSendPrompt, pane.id])

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
            proMode ? (
              <div className="w-8 h-8 rounded bg-rpg-accent/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                C
              </div>
            ) : session.avatarSvg ? (
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
                  {proMode ? (
                    <span className="font-medium text-sm">Claude</span>
                  ) : (
                    <span className="font-medium text-sm">{session.name}</span>
                  )}
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
          <div className="flex items-center gap-1 flex-shrink-0">
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
          {/* Fork info + GitHub Links */}
          {pane.repo?.org && (
            <GitHubLinks repo={pane.repo} />
          )}

          {/* Session stats bar for Claude sessions */}
          {isClaudePane && session && (
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
            {/* Pending question input */}
            {isClaudePane && session?.pendingQuestion && (
              <QuestionInput
                pendingQuestion={session.pendingQuestion}
                onAnswer={handleAnswer}
                compact={true}
              />
            )}

            {/* Regular input (when no pending question) */}
            {showInput && !session?.pendingQuestion && (
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
                      placeholder="Enter password..."
                      className="flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-waiting/50 rounded focus:border-rpg-waiting outline-none min-h-[44px]"
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
                            // Reset height after sending
                            if (inputRef.current) {
                              inputRef.current.style.height = 'auto'
                            }
                          } else {
                            onSendPrompt(pane.id, '') // Just Enter
                          }
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={isClaudePane ? "Send prompt... (Shift+Enter for newline)" : "Send input..."}
                      className="flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none min-h-[44px] max-h-[200px] resize-none"
                      rows={1}
                    />
                    <VoiceButton onTranscription={handleVoiceTranscription} />
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (inputValue.trim()) {
                      handleSend()
                    } else {
                      onSendPrompt(pane.id, '') // Just Enter
                    }
                    // Reset height after sending
                    if (inputRef.current) {
                      inputRef.current.style.height = 'auto'
                    }
                  }}
                  className={`w-full sm:w-auto px-4 py-2 text-sm rounded transition-colors active:scale-95 min-h-[44px] ${
                    inputValue.trim()
                      ? isPassword ? 'bg-rpg-waiting/30 hover:bg-rpg-waiting/50' : 'bg-rpg-accent/30 hover:bg-rpg-accent/50'
                      : 'bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle'
                  }`}
                  title={inputValue.trim() ? "Send message" : "Send Enter (accept suggestion)"}
                >
                  {inputValue.trim() ? 'Send' : '⏎ Enter'}
                </button>
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
          </div>
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  // Custom comparison - only re-render when visible state changes
  if (prev.proMode !== next.proMode) return false
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
  if (session.lastPrompt) {
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
      label: 'Create PR',
      url: `${baseUrl}/compare/${repo.defaultBranch}...${repo.branch}?expand=1`,
      icon: '➕',
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      {/* Quick links */}
      <div className="flex gap-1 ml-auto">
        {links.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="px-2 py-1 text-xs bg-rpg-bg-elevated hover:bg-rpg-border rounded transition-colors"
            title={link.label}
          >
            {link.icon}
          </a>
        ))}
      </div>
    </div>
  )
})

// Expanded terminal view
const ExpandedTerminal = memo(function ExpandedTerminal({ content, onTerminalClick }: { content: string | undefined, onTerminalClick?: () => void }) {
  const terminalRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!terminalRef.current) return
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    })
  }, [content])

  return (
    <pre
      ref={terminalRef}
      onClick={onTerminalClick}
      className="bg-rpg-bg rounded p-3 text-xs font-mono text-rpg-working overflow-auto max-h-64 whitespace-pre-wrap border border-rpg-border-dim cursor-text"
    >
      {content || <span className="text-rpg-text-dim">Waiting for activity...</span>}
    </pre>
  )
})

// Session stats bar - shows XP and activity for current session
const SessionStatsBar = memo(function SessionStatsBar({ stats }: { stats: SessionStats | undefined }) {
  if (!stats || stats.totalXPGained === 0) return null

  // Calculate total tools used
  const totalTools = Object.values(stats.toolsUsed).reduce((sum, count) => sum + count, 0)

  // Calculate total git operations
  const totalGit = stats.git.commits + stats.git.pushes + stats.git.prsCreated + stats.git.prsMerged

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
