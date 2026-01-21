import { useState, useEffect, useRef, memo, useCallback } from 'react'
import type { TmuxPane, TmuxWindow, ClaudeSessionInfo, SessionStatus } from '@shared/types'
import { usePaneTerminal } from '../hooks/usePaneTerminal'

// Status theme - applies to all panes
const statusTheme = {
  idle:    { border: 'border-rpg-idle/50',   bg: 'bg-rpg-card',       indicator: 'bg-rpg-idle' },
  typing:  { border: 'border-rpg-accent/70', bg: 'bg-rpg-accent/5',   indicator: 'bg-rpg-accent' },
  working: { border: 'border-rpg-working',   bg: 'bg-rpg-card',       indicator: 'bg-rpg-working' },
  waiting: { border: 'border-rpg-waiting',   bg: 'bg-rpg-waiting/10', indicator: 'bg-rpg-waiting' },
  error:   { border: 'border-rpg-error',     bg: 'bg-rpg-error/10',   indicator: 'bg-rpg-error' },
} as const

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  typing: 'Active',
  working: 'Working',
  waiting: 'Waiting',
  error: 'Error',
  shell: 'Shell',
  process: 'Running',
}

interface PaneCardProps {
  pane: TmuxPane
  window: TmuxWindow
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  proMode?: boolean
  compact?: boolean
}

export const PaneCard = memo(function PaneCard({ pane, window, onSendPrompt, onSendSignal, proMode = false, compact = false }: PaneCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const terminalContent = usePaneTerminal(pane.id)
  const inputRef = useRef<HTMLInputElement>(null)

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession

  // Determine status for theming
  const status: string = isClaudePane && session
    ? session.status
    : pane.process.typing ? 'typing' : pane.process.type

  const theme = statusTheme[status as keyof typeof statusTheme] || statusTheme.idle
  const statusLabel = statusLabels[status] || status

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSendPrompt(pane.id, inputValue.trim())
      setInputValue('')
    }
  }, [onSendPrompt, pane.id, inputValue])

  const handleEnter = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSendPrompt(pane.id, '') // Empty string = just send Enter
  }, [onSendPrompt, pane.id])

  const handleCtrlC = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSendSignal(pane.id, 'SIGINT')
  }, [onSendSignal, pane.id])

  const handleAnswer = useCallback((answer: string) => {
    onSendPrompt(pane.id, answer)
  }, [onSendPrompt, pane.id])

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

  // Auto-focus input when panel expands
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showInput])

  // Compact mode: simpler display for idle panes
  if (compact && !expanded) {
    return (
      <div
        className={`rounded-lg border ${theme.border} bg-rpg-card/50 transition-all cursor-pointer hover:border-rpg-accent/50`}
        onClick={toggleExpanded}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          {/* Minimal icon */}
          {isClaudePane && session ? (
            <div className="w-6 h-6 rounded bg-rpg-accent/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
              C
            </div>
          ) : (
            <div className="w-6 h-6 rounded bg-rpg-bg/50 flex items-center justify-center text-xs font-mono flex-shrink-0 text-rpg-idle">
              $
            </div>
          )}

          {/* Name */}
          <span className="text-sm text-rpg-idle/80 truncate">
            {isClaudePane && session ? session.name : pane.process.command}
          </span>

          {/* Repo badge */}
          {pane.repo && (
            <span className="text-xs text-rpg-accent/60 truncate">
              {pane.repo.name}
            </span>
          )}

          {/* Expand hint */}
          <span className="ml-auto text-rpg-idle/30 text-xs">▼</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border-2 ${theme.border} ${theme.bg} transition-all`}>
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
            <div className={`w-8 h-8 rounded bg-rpg-bg/50 flex items-center justify-center text-sm font-mono flex-shrink-0 ${pane.process.typing ? 'text-rpg-accent' : 'text-rpg-idle'}`}>
              {pane.process.type === 'shell' ? '$' : '>'}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {/* Name/Command */}
              {isClaudePane && session ? (
                proMode ? (
                  <span className="font-medium text-sm">Claude</span>
                ) : (
                  <span className="font-medium text-sm">{session.name}</span>
                )
              ) : (
                <span className="font-mono text-sm">{pane.process.command}</span>
              )}

              {/* Repo */}
              {pane.repo && (
                <span className="text-xs text-rpg-accent truncate">
                  {pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name}
                </span>
              )}

              {/* Status indicator */}
              <div className="flex items-center gap-1 ml-auto">
                <div className={`w-2 h-2 rounded-full ${theme.indicator} ${
                  status === 'working' || status === 'typing' ? 'animate-pulse' : ''
                }`} />
                <span className="text-xs text-rpg-idle/70">{statusLabel}</span>
              </div>
            </div>

            {/* Activity line */}
            <div className="text-sm text-rpg-text/80 truncate">
              {isClaudePane && session ? (
                <ClaudeActivity session={session} />
              ) : (
                <span className="text-rpg-idle/50">
                  <span className="text-rpg-idle/30">Command:</span> {pane.cwd.split('/').slice(-2).join('/')}
                </span>
              )}
            </div>
          </div>

          {/* Expand indicator */}
          <div className="text-rpg-idle/50 text-xs flex-shrink-0">
            {expanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Pending Question (Claude only) - always visible when present */}
      {isClaudePane && session?.pendingQuestion && (
        <PendingQuestionSection
          question={session.pendingQuestion}
          onAnswer={handleAnswer}
        />
      )}

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
          {/* Terminal */}
          <ExpandedTerminal content={terminalContent} />

          {/* Input row */}
          <div className="flex gap-2">
            {showInput && (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      if (inputValue.trim()) {
                        handleSend()
                      } else {
                        onSendPrompt(pane.id, '') // Just Enter
                      }
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={isClaudePane ? "Send prompt..." : "Send input..."}
                  className="flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none min-h-[40px]"
                />
                <button
                  onClick={handleEnter}
                  className="px-3 py-2 text-sm bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle rounded transition-colors active:scale-95 min-h-[40px]"
                  title="Send Enter (accept suggestion)"
                >
                  ⏎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSend()
                  }}
                  disabled={!inputValue.trim()}
                  className="px-4 py-2 text-sm bg-rpg-accent/30 hover:bg-rpg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors active:scale-95 min-h-[40px]"
                >
                  Send
                </button>
              </>
            )}
            {showCtrlC && (
              <button
                onClick={handleCtrlC}
                className="px-4 py-2 text-sm bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error rounded transition-colors active:scale-95 min-h-[40px] ml-auto"
              >
                Ctrl+C
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
  }
  // Compare repo
  if (prev.pane.repo?.name !== next.pane.repo?.name) return false
  if (prev.pane.repo?.org !== next.pane.repo?.org) return false
  return true
})

// Claude activity display
const ClaudeActivity = memo(function ClaudeActivity({ session }: { session: ClaudeSessionInfo }) {
  if (session.lastPrompt) {
    return <span><span className="text-rpg-idle/30">Prompt:</span> {session.lastPrompt}</span>
  }
  if (session.currentTool) {
    return (
      <span className="text-rpg-idle">
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
  return <span className="text-rpg-idle/50">Ready</span>
})

// Pending question section
interface PendingQuestionSectionProps {
  question: { question: string; options: Array<{ label: string; description?: string }> }
  onAnswer: (answer: string) => void
}

const PendingQuestionSection = memo(function PendingQuestionSection({ question, onAnswer }: PendingQuestionSectionProps) {
  const [customAnswer, setCustomAnswer] = useState('')

  return (
    <div className="px-3 pb-3">
      <div className="p-3 bg-rpg-waiting/20 rounded border border-rpg-waiting/50">
        <p className="text-sm font-medium mb-2">{question.question}</p>
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                onAnswer(opt.label)
              }}
              className="px-3 py-2 text-sm bg-rpg-accent/20 hover:bg-rpg-accent/40 rounded border border-rpg-accent/50 transition-colors active:scale-95 min-h-[40px]"
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customAnswer.trim()) {
                e.stopPropagation()
                onAnswer(customAnswer.trim())
                setCustomAnswer('')
              }
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Or type custom answer..."
            className="flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none min-h-[40px]"
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (customAnswer.trim()) {
                onAnswer(customAnswer.trim())
                setCustomAnswer('')
              }
            }}
            className="px-4 py-2 text-sm bg-rpg-accent/30 hover:bg-rpg-accent/50 rounded transition-colors active:scale-95 min-h-[40px]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
})

// Expanded terminal view
const ExpandedTerminal = memo(function ExpandedTerminal({ content }: { content: string | undefined }) {
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
      className="bg-rpg-bg/80 rounded p-3 text-xs font-mono text-rpg-working overflow-auto max-h-64 whitespace-pre-wrap"
    >
      {content || <span className="text-rpg-idle/50">Waiting for activity...</span>}
    </pre>
  )
})
