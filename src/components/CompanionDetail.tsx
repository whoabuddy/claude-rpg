import { useState, useEffect, useRef } from 'react'
import type { Companion, TerminalOutput } from '@shared/types'
import { xpForLevel } from '@shared/types'

interface CompanionDetailProps {
  companion: Companion
}

function useTerminalOutput(companionId: string) {
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    const handleOutput = (e: CustomEvent<TerminalOutput>) => {
      if (e.detail.companionId === companionId) {
        setContent(e.detail.content)
      }
    }

    window.addEventListener('terminal_output', handleOutput as EventListener)
    return () => window.removeEventListener('terminal_output', handleOutput as EventListener)
  }, [companionId])

  return content
}

export function CompanionDetail({ companion }: CompanionDetailProps) {
  const xpNeeded = xpForLevel(companion.level)
  const xpPercent = (companion.experience / xpNeeded) * 100
  const terminalContent = useTerminalOutput(companion.id)
  const terminalRef = useRef<HTMLPreElement>(null)

  // Auto-scroll terminal to bottom when content changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalContent])

  return (
    <div className="p-4 space-y-4">
      {/* Header with name, level, XP */}
      <div className="bg-rpg-card rounded-lg p-4 border border-rpg-border">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-rpg-accent/30 flex items-center justify-center text-2xl font-bold">
            {companion.name[0]}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h2 className="text-xl font-bold">{companion.name}</h2>
            <p className="text-sm text-rpg-idle">{companion.repo.name}</p>
            <p className="text-xs text-rpg-idle/70">{companion.repo.org || 'local'}</p>
          </div>

          {/* Level badge */}
          <div className="text-center">
            <div className="text-3xl font-bold text-rpg-xp">{companion.level}</div>
            <div className="text-xs text-rpg-idle">Level</div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-4">
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

      {/* Current Status */}
      <div className="bg-rpg-card rounded-lg p-4 border border-rpg-border">
        <h3 className="text-sm font-medium text-rpg-idle mb-2">Status</h3>
        <div className="flex items-center gap-2">
          <StatusIndicator status={companion.state.status} />
          <span className="capitalize">{companion.state.status}</span>
          {companion.state.currentTool && (
            <span className="text-rpg-accent">
              • {companion.state.currentTool}
              {companion.state.currentFile && `: ${companion.state.currentFile.split('/').pop()}`}
            </span>
          )}
        </div>
      </div>

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

      {/* Terminal Output */}
      <div className="bg-rpg-card rounded-lg p-4 border border-rpg-border">
        <h3 className="text-sm font-medium text-rpg-idle mb-3">Terminal</h3>
        <pre
          ref={terminalRef}
          className="bg-black/50 rounded p-3 text-xs font-mono text-green-400 overflow-auto max-h-48 whitespace-pre-wrap"
        >
          {terminalContent || <span className="text-rpg-idle/50">Waiting for activity...</span>}
        </pre>
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: string }) {
  const colors = {
    idle: 'bg-rpg-idle',
    working: 'bg-rpg-working',
    waiting: 'bg-rpg-waiting',
    attention: 'bg-rpg-error',
    offline: 'bg-rpg-idle/50',
  }

  return (
    <div
      className={`w-3 h-3 rounded-full ${colors[status as keyof typeof colors] || colors.idle} ${
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
