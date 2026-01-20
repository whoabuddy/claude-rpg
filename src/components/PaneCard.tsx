import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react'
import type { TmuxPane, TmuxWindow, ClaudeSessionInfo, SessionStatus } from '@shared/types'
import { usePaneTerminal } from '../hooks/usePaneTerminal'

const TERMINAL_PREVIEW_LINES = 15

// Consolidated status theme for Claude sessions
const statusTheme = {
  idle:    { border: 'border-rpg-idle/50',   bg: 'bg-rpg-card',       indicator: 'bg-rpg-idle' },
  typing:  { border: 'border-rpg-accent/70', bg: 'bg-rpg-accent/5',   indicator: 'bg-rpg-accent' },
  working: { border: 'border-rpg-working',   bg: 'bg-rpg-card',       indicator: 'bg-rpg-working' },
  waiting: { border: 'border-rpg-waiting',   bg: 'bg-rpg-waiting/10', indicator: 'bg-rpg-waiting' },
  error:   { border: 'border-rpg-error',     bg: 'bg-rpg-error/10',   indicator: 'bg-rpg-error' },
} as const

const indicatorLabels: Record<SessionStatus, string> = {
  idle: 'Idle',
  typing: 'Typing',
  working: 'Working',
  waiting: 'Waiting',
  error: 'Error',
}

// Process type colors for non-Claude panes
const processColors = {
  shell: 'border-rpg-idle/30',
  process: 'border-blue-500/50',
  idle: 'border-rpg-idle/20',
} as const

interface PaneCardProps {
  pane: TmuxPane
  window: TmuxWindow
  onSendPrompt: (paneId: string, prompt: string) => void
  compact?: boolean
}

export const PaneCard = memo(function PaneCard({ pane, window, onSendPrompt, compact = false }: PaneCardProps) {
  const isClaudePane = pane.process.type === 'claude'
  const claudeSession = pane.process.claudeSession

  if (isClaudePane && claudeSession) {
    return (
      <ClaudePaneCard
        pane={pane}
        window={window}
        session={claudeSession}
        onSendPrompt={onSendPrompt}
        compact={compact}
      />
    )
  }

  return (
    <ProcessPaneCard
      pane={pane}
      compact={compact}
    />
  )
})

// Helper to get activity display text - extracted from nested ternary
function getActivityDisplay(session: ClaudeSessionInfo): React.ReactNode {
  if (session.lastPrompt) {
    return <span><span className="text-rpg-idle/50">Task:</span> {session.lastPrompt}</span>
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
  return <span className="text-rpg-idle/50">No recent activity</span>
}

// Memoized terminal preview component to prevent re-renders
const TerminalPreview = memo(function TerminalPreview({
  content,
  lines = TERMINAL_PREVIEW_LINES,
  className = ''
}: {
  content: string | undefined
  lines?: number
  className?: string
}) {
  const preview = useMemo(
    () => content?.split('\n').slice(-lines).join('\n') || '',
    [content, lines]
  )

  const previewRef = useRef<HTMLPreElement>(null)

  // Use requestAnimationFrame to avoid layout thrashing
  useEffect(() => {
    if (!previewRef.current) return
    requestAnimationFrame(() => {
      if (previewRef.current) {
        previewRef.current.scrollTop = previewRef.current.scrollHeight
      }
    })
  }, [preview])

  if (!preview) return null

  return (
    <pre
      ref={previewRef}
      className={`bg-black/30 rounded px-2 py-1.5 text-xs font-mono text-green-400/70 overflow-auto max-h-64 whitespace-pre-wrap ${className}`}
    >
      {preview}
    </pre>
  )
})

// Memoized expanded terminal component
const ExpandedTerminal = memo(function ExpandedTerminal({
  content
}: {
  content: string | undefined
}) {
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
      className="bg-black/50 rounded p-3 text-xs font-mono text-green-400 overflow-auto max-h-64 whitespace-pre-wrap"
    >
      {content || <span className="text-rpg-idle/50">Waiting for activity...</span>}
    </pre>
  )
})

// Claude-specific pane card
interface ClaudePaneCardProps {
  pane: TmuxPane
  window: TmuxWindow
  session: ClaudeSessionInfo
  onSendPrompt: (paneId: string, prompt: string) => void
  compact?: boolean
}

const ClaudePaneCard = memo(function ClaudePaneCard({ pane, session, onSendPrompt, compact }: ClaudePaneCardProps) {
  const [answerInput, setAnswerInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const terminalContent = usePaneTerminal(pane.id)

  const handleAnswer = useCallback((answer: string) => {
    onSendPrompt(pane.id, answer)
    setAnswerInput('')
  }, [onSendPrompt, pane.id])

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])

  const theme = statusTheme[session.status]

  return (
    <div className={`rounded-lg border-2 ${theme.border} ${theme.bg} transition-all`}>
      {/* Header */}
      <div className="p-3 cursor-pointer" onClick={toggleExpanded}>
        <div className="flex items-start gap-3">
          {/* Bitcoin Face Avatar */}
          {session.avatarSvg ? (
            <div
              className="w-10 h-10 rounded-full overflow-hidden bg-rpg-bg flex-shrink-0"
              dangerouslySetInnerHTML={{ __html: session.avatarSvg }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-rpg-accent/30 flex items-center justify-center text-base font-bold flex-shrink-0">
              {session.name[0]}
            </div>
          )}

          {/* Session info */}
          <div className="flex-1 min-w-0">
            {/* Name + Project + Status */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{session.name}</span>
              {pane.repo && (
                <span className="text-xs text-rpg-accent">
                  {pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name}
                </span>
              )}
              <StatusIndicator status={session.status} />
            </div>

            {/* Activity context */}
            <div className="text-sm text-white/90 line-clamp-2">
              {getActivityDisplay(session)}
            </div>

            {/* Recent files */}
            {!compact && session.recentFiles && session.recentFiles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {session.recentFiles.slice(0, 3).map((file, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 text-xs bg-rpg-bg/50 rounded text-rpg-idle/70 truncate max-w-[100px]"
                    title={file}
                  >
                    {file}
                  </span>
                ))}
                {session.recentFiles.length > 3 && (
                  <span className="px-1.5 py-0.5 text-xs text-rpg-idle/50">
                    +{session.recentFiles.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Expand indicator */}
          <div className="text-rpg-idle/50 text-xs flex-shrink-0">
            {expanded ? '\u25B2' : '\u25BC'}
          </div>
        </div>

        {/* Terminal preview */}
        {!compact && !expanded && (
          <div className="mt-2">
            <TerminalPreview content={terminalContent} />
          </div>
        )}
      </div>

      {/* Pending Question */}
      {session.pendingQuestion && (
        <div className="px-3 pb-3">
          <div className="p-3 bg-rpg-waiting/20 rounded border border-rpg-waiting/50">
            <p className="text-sm font-medium mb-2">{session.pendingQuestion.question}</p>
            <div className="flex flex-wrap gap-2">
              {session.pendingQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAnswer(opt.label)
                  }}
                  className="px-3 py-2.5 text-sm bg-rpg-accent/20 hover:bg-rpg-accent/40 rounded border border-rpg-accent/50 transition-colors active:scale-95 min-h-[44px]"
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Custom answer input */}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && answerInput.trim()) {
                    e.stopPropagation()
                    handleAnswer(answerInput.trim())
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Or type custom answer..."
                className="flex-1 px-3 py-2.5 text-sm bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none min-h-[44px]"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (answerInput.trim()) handleAnswer(answerInput.trim())
                }}
                className="px-4 py-2.5 text-sm bg-rpg-accent/30 hover:bg-rpg-accent/50 rounded transition-colors active:scale-95 min-h-[44px]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error details */}
      {session.status === 'error' && session.lastError && !session.pendingQuestion && (
        <div className="px-3 pb-3">
          <div className="p-3 bg-rpg-error/20 rounded border border-rpg-error/50">
            <p className="text-sm">
              <span className="font-medium">Tool:</span> {session.lastError.tool}
            </p>
            {session.lastError.message && (
              <p className="text-sm text-rpg-error mt-1">{session.lastError.message}</p>
            )}
            <p className="text-xs text-rpg-idle/50 mt-2">
              {new Date(session.lastError.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Expanded terminal */}
      {expanded && (
        <div className="px-3 pb-3">
          <ExpandedTerminal content={terminalContent} />
        </div>
      )}
    </div>
  )
})

// Non-Claude process pane card - removed unused window prop
interface ProcessPaneCardProps {
  pane: TmuxPane
  compact?: boolean
}

const ProcessPaneCard = memo(function ProcessPaneCard({ pane, compact }: ProcessPaneCardProps) {
  const [expanded, setExpanded] = useState(false)
  const terminalContent = usePaneTerminal(pane.id)

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])

  const borderColor = processColors[pane.process.type as keyof typeof processColors] || processColors.idle

  return (
    <div className={`rounded-lg border ${borderColor} bg-rpg-card/50 transition-all`}>
      <div className="p-3 cursor-pointer" onClick={toggleExpanded}>
        <div className="flex items-center gap-3">
          {/* Process icon */}
          <div className="w-8 h-8 rounded bg-rpg-bg/50 flex items-center justify-center text-sm font-mono text-rpg-idle flex-shrink-0">
            {pane.process.type === 'shell' ? '$' : pane.process.type === 'process' ? '>' : '-'}
          </div>

          {/* Process info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{pane.process.command}</span>
              {pane.repo && (
                <span className="text-xs text-rpg-accent">
                  {pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name}
                </span>
              )}
            </div>
            <div className="text-xs text-rpg-idle/50 truncate">
              {pane.cwd}
            </div>
          </div>

          {/* Pane target */}
          <div className="text-xs text-rpg-idle/30 font-mono flex-shrink-0">
            {pane.target}
          </div>
        </div>

        {/* Terminal preview */}
        {!compact && !expanded && (
          <div className="mt-2">
            <TerminalPreview content={terminalContent} lines={8} className="bg-black/20 text-rpg-idle/50 max-h-20" />
          </div>
        )}
      </div>

      {/* Expanded terminal */}
      {expanded && (
        <div className="px-3 pb-3">
          <ExpandedTerminal content={terminalContent} />
        </div>
      )}
    </div>
  )
})

function StatusIndicator({ status }: { status: SessionStatus }) {
  const theme = statusTheme[status] || statusTheme.idle
  const label = indicatorLabels[status] || status

  return (
    <div className="flex items-center gap-1">
      <div
        className={`w-2 h-2 rounded-full ${theme.indicator} ${
          status === 'working' || status === 'typing' ? 'animate-pulse' : ''
        }`}
      />
      <span className="text-xs text-rpg-idle/70">{label}</span>
    </div>
  )
}
