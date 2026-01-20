import { useState, useEffect, useRef } from 'react'
import type { Companion, TerminalOutput, Session } from '@shared/types'
import { xpForLevel } from '@shared/types'

interface CompanionDetailProps {
  companion: Companion
  onSendPrompt?: (sessionId: string, prompt: string) => void
}

function useTerminalOutput(sessionId: string | null) {
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    if (!sessionId) return

    const handleOutput = (e: CustomEvent<TerminalOutput>) => {
      if (e.detail.sessionId === sessionId) {
        setContent(e.detail.content)
      }
    }

    window.addEventListener('terminal_output', handleOutput as EventListener)
    return () => window.removeEventListener('terminal_output', handleOutput as EventListener)
  }, [sessionId])

  return content
}

export function CompanionDetail({ companion, onSendPrompt }: CompanionDetailProps) {
  const xpNeeded = xpForLevel(companion.level)
  const xpPercent = (companion.experience / xpNeeded) * 100
  const sessions = companion.state.sessions || []
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions.length > 0 ? sessions[0].id : null
  )

  // Update selected session when sessions change
  useEffect(() => {
    if (sessions.length > 0 && !sessions.find(s => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0].id)
    }
  }, [sessions, selectedSessionId])

  const selectedSession = sessions.find(s => s.id === selectedSessionId)
  const terminalContent = useTerminalOutput(selectedSessionId)
  const terminalRef = useRef<HTMLPreElement>(null)

  // Auto-scroll terminal to bottom when content changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalContent])

  return (
    <div className="p-4 space-y-4">
      {/* Project Header with level, XP */}
      <div className="bg-rpg-card rounded-lg p-4 border border-rpg-border">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{companion.repo.name}</h2>
            <p className="text-xs text-rpg-idle/70">{companion.repo.org || 'local'}</p>
          </div>

          {/* Level badge */}
          <div className="text-center">
            <div className="text-2xl font-bold text-rpg-xp">{companion.level}</div>
            <div className="text-xs text-rpg-idle">Level</div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-rpg-idle mb-1">
            <span>XP</span>
            <span>{companion.experience} / {xpNeeded}</span>
          </div>
          <div className="h-2 bg-rpg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-rpg-xp xp-bar rounded-full"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="bg-rpg-card rounded-lg p-4 border border-rpg-border">
        <h3 className="text-sm font-medium text-rpg-idle mb-3">
          Sessions ({sessions.length})
        </h3>

        {sessions.length === 0 ? (
          <p className="text-sm text-rpg-idle/50">No active sessions</p>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                isSelected={session.id === selectedSessionId}
                onSelect={() => setSelectedSessionId(session.id)}
                onSendPrompt={onSendPrompt}
              />
            ))}
          </div>
        )}
      </div>

      {/* Terminal Output for selected session */}
      {selectedSession && (
        <div className="bg-rpg-card rounded-lg p-4 border border-rpg-border">
          <h3 className="text-sm font-medium text-rpg-idle mb-3">
            Terminal - {selectedSession.name}
          </h3>
          <pre
            ref={terminalRef}
            className="bg-black/50 rounded p-3 text-xs font-mono text-green-400 overflow-auto max-h-48 whitespace-pre-wrap"
          >
            {terminalContent || <span className="text-rpg-idle/50">Waiting for activity...</span>}
          </pre>
        </div>
      )}

      {/* Stats */}
      <div className="bg-rpg-card rounded-lg p-4 border border-rpg-border">
        <h3 className="text-sm font-medium text-rpg-idle mb-3">Stats</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <StatItem label="Sessions" value={companion.stats.sessionsCompleted} />
          <StatItem label="Prompts" value={companion.stats.promptsReceived} />
          <StatItem label="Commits" value={companion.stats.git.commits} />
          <StatItem label="PRs Created" value={companion.stats.git.prsCreated} />
          <StatItem label="Tests Run" value={companion.stats.commands.testsRun} />
          <StatItem label="Deploys" value={companion.stats.commands.deploysRun} />
        </div>
      </div>
    </div>
  )
}

interface SessionCardProps {
  session: Session
  isSelected: boolean
  onSelect: () => void
  onSendPrompt?: (sessionId: string, prompt: string) => void
}

function SessionCard({ session, isSelected, onSelect, onSendPrompt }: SessionCardProps) {
  const [answerInput, setAnswerInput] = useState('')

  const handleAnswer = (answer: string) => {
    if (onSendPrompt) {
      onSendPrompt(session.id, answer)
      setAnswerInput('')
    }
  }

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? 'bg-rpg-accent/20 border-rpg-accent'
          : 'bg-rpg-bg/50 border-rpg-border hover:border-rpg-accent/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        {/* Bitcoin Face Avatar */}
        {session.avatarSvg ? (
          <div
            className="w-10 h-10 rounded-full overflow-hidden bg-rpg-bg"
            dangerouslySetInnerHTML={{ __html: session.avatarSvg }}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-rpg-accent/30 flex items-center justify-center text-sm font-bold">
            {session.name[0]}
          </div>
        )}

        {/* Session info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{session.name}</span>
            <StatusIndicator status={session.status} />
          </div>
          <div className="text-xs text-rpg-idle truncate">
            {session.currentTool ? (
              <span>
                {session.currentTool}
                {session.currentFile && `: ${session.currentFile.split('/').pop()}`}
              </span>
            ) : (
              <span className="text-rpg-idle/50">
                {session.id.slice(0, 8)}...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pending Question */}
      {session.pendingQuestion && (
        <div className="mt-3 p-3 bg-rpg-waiting/20 rounded border border-rpg-waiting/50">
          <p className="text-sm font-medium mb-2">{session.pendingQuestion.question}</p>
          <div className="flex flex-wrap gap-2">
            {session.pendingQuestion.options.map((opt, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAnswer(opt.label)
                }}
                className="px-3 py-1 text-xs bg-rpg-accent/20 hover:bg-rpg-accent/40 rounded border border-rpg-accent/50 transition-colors"
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
              className="flex-1 px-2 py-1 text-xs bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (answerInput.trim()) handleAnswer(answerInput.trim())
              }}
              className="px-2 py-1 text-xs bg-rpg-accent/30 hover:bg-rpg-accent/50 rounded transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusIndicator({ status }: { status: string }) {
  const colors = {
    idle: 'bg-rpg-idle',
    working: 'bg-rpg-working',
    waiting: 'bg-rpg-waiting',
    error: 'bg-rpg-error',
    attention: 'bg-rpg-error',
    offline: 'bg-rpg-idle/50',
  }

  return (
    <div
      className={`w-2 h-2 rounded-full ${colors[status as keyof typeof colors] || colors.idle} ${
        status === 'working' ? 'animate-pulse' : ''
      }`}
    />
  )
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-rpg-idle">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
