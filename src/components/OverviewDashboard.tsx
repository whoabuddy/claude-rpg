import { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'
import { PaneCard } from './PaneCard'
import { ConnectionBanner } from './ConnectionStatus'
import { StatusPill } from './StatusPill'
import { usePaneActions } from '../contexts/PaneActionsContext'
import { ActionButton } from './ActionButton'

// Maximum panes per window (must match server constant)
const MAX_PANES_PER_WINDOW = 4

interface OverviewDashboardProps {
  windows: TmuxWindow[]
  attentionCount: number
  connected: boolean
  onNewPane: (windowId: string) => void
  onNewClaude: (windowId: string) => void
  onCreateWindow: (sessionName: string, windowName: string) => Promise<boolean>
  onRenameWindow: (windowId: string, windowName: string) => Promise<{ ok: boolean; error?: string }>
  onNavigateToCompetitions: () => void
}

interface WindowGroup {
  window: TmuxWindow
  panes: TmuxPane[]
  attentionCount: number
  primaryRepo: string | null // "org/repo" or just "repo" or null
}

function needsAttention(pane: TmuxPane): boolean {
  if (pane.process.type !== 'claude') return false
  const session = pane.process.claudeSession
  if (!session) return false
  return session.status === 'waiting' || session.status === 'error' || !!session.pendingQuestion
}

function getPrimaryRepo(panes: TmuxPane[]): string | null {
  // Count repos across all panes
  const repoCounts = new Map<string, number>()
  for (const pane of panes) {
    if (pane.repo) {
      const key = pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name
      repoCounts.set(key, (repoCounts.get(key) || 0) + 1)
    }
  }

  if (repoCounts.size === 0) return null

  // If there's only one repo, or one repo is dominant (>50%), show it
  const entries = Array.from(repoCounts.entries())
  if (entries.length === 1) return entries[0][0]

  // Find the most common repo
  entries.sort((a, b) => b[1] - a[1])
  const [topRepo, topCount] = entries[0]

  // Only show if it's the majority
  if (topCount > panes.length / 2) return topRepo

  return null
}

export const OverviewDashboard = memo(function OverviewDashboard({
  windows,
  attentionCount,
  connected,
  onNewPane,
  onNewClaude,
  onCreateWindow,
  onRenameWindow,
  onNavigateToCompetitions,
}: OverviewDashboardProps) {
  const { rpgEnabled } = usePaneActions()
  const [collapsedWindows, setCollapsedWindows] = useState<Set<string>>(new Set())
  const [showCreateWindow, setShowCreateWindow] = useState(false)
  const [newWindowName, setNewWindowName] = useState('')
  const [selectedSession, setSelectedSession] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Group panes by window, extract unique sessions
  const { windowGroups, stats, sessions } = useMemo(() => {
    const groups: WindowGroup[] = []
    const sessionSet = new Set<string>()
    let totalPanes = 0
    let claudeCount = 0

    for (const window of windows) {
      const panes = [...window.panes]
      totalPanes += panes.length
      sessionSet.add(window.sessionName)

      for (const pane of panes) {
        if (pane.process.type === 'claude') claudeCount++
      }

      // Keep panes in natural tmux order - no sorting to avoid layout shift
      const windowAttention = panes.filter(needsAttention).length

      groups.push({
        window,
        panes,
        attentionCount: windowAttention,
        primaryRepo: getPrimaryRepo(panes),
      })
    }

    // Keep windows in stable order by index - no sorting by attention to avoid layout shift
    groups.sort((a, b) => a.window.windowIndex - b.window.windowIndex)

    return {
      windowGroups: groups,
      stats: {
        total: totalPanes,
        claude: claudeCount,
        windows: windows.length,
      },
      sessions: Array.from(sessionSet).sort(),
    }
  }, [windows])

  const toggleWindow = useCallback((windowId: string) => {
    setCollapsedWindows(prev => {
      const next = new Set(prev)
      if (next.has(windowId)) {
        next.delete(windowId)
      } else {
        next.add(windowId)
      }
      return next
    })
  }, [])

  const allCollapsed = windowGroups.length > 0 && collapsedWindows.size === windowGroups.length
  const toggleAllWindows = () => {
    if (allCollapsed) {
      setCollapsedWindows(new Set())
    } else {
      setCollapsedWindows(new Set(windowGroups.map(g => g.window.id)))
    }
  }

  const handleOpenCreateWindow = () => {
    setShowCreateWindow(true)
    setNewWindowName('')
    setCreateError(null)
    // Default to first session if available
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0])
    }
  }

  const handleCreateWindow = async () => {
    if (!selectedSession || !newWindowName.trim()) {
      setCreateError('Session and window name are required')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    const success = await onCreateWindow(selectedSession, newWindowName.trim())

    setIsCreating(false)

    if (success) {
      setShowCreateWindow(false)
      setNewWindowName('')
    } else {
      setCreateError('Failed to create window')
    }
  }

  const handleCancelCreate = () => {
    setShowCreateWindow(false)
    setNewWindowName('')
    setCreateError(null)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-rpg-text-muted whitespace-nowrap">
            {stats.windows}W / {stats.total}P
          </span>
          {attentionCount > 0 && (
            <span className="px-2 py-0.5 rounded status-bg-waiting text-rpg-waiting text-xs font-medium animate-pulse whitespace-nowrap">
              {attentionCount} waiting
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {sessions.length > 0 && (
            <ActionButton icon="+" label="New Window" shortLabel="Win" variant="accent" onClick={handleOpenCreateWindow} />
          )}
          {windowGroups.length > 1 && (
            <ActionButton
              icon={allCollapsed ? '▼' : '▲'}
              label={allCollapsed ? 'Expand All' : 'Collapse All'}
              shortLabel={allCollapsed ? 'Expand' : 'Collapse'}
              variant="ghost"
              onClick={toggleAllWindows}
            />
          )}
          {rpgEnabled && (
            <ActionButton icon="🏆" label="Leaderboard" shortLabel="LB" variant="ghost" onClick={onNavigateToCompetitions} className="hidden sm:flex" />
          )}
          <StatusPill connected={connected} />
        </div>
      </div>

      {/* Disconnected banner */}
      <ConnectionBanner connected={connected} />

      {/* Create Window Form */}
      {showCreateWindow && (
        <div className="rounded-lg border border-rpg-accent bg-rpg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-rpg-text">Create New Window</span>
            <button
              onClick={handleCancelCreate}
              className="text-rpg-text-muted hover:text-rpg-text text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Session Select */}
            <div className="flex-1">
              <label className="block text-xs text-rpg-text-muted mb-1">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded bg-rpg-bg-elevated border border-rpg-border text-rpg-text focus:outline-none focus:border-rpg-accent"
              >
                {sessions.map(session => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </select>
            </div>

            {/* Window Name Input */}
            <div className="flex-1">
              <label className="block text-xs text-rpg-text-muted mb-1">Window Name</label>
              <input
                type="text"
                value={newWindowName}
                onChange={(e) => setNewWindowName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateWindow()}
                placeholder="my-project"
                autoFocus
                className="w-full px-3 py-2 text-sm rounded bg-rpg-bg-elevated border border-rpg-border text-rpg-text placeholder:text-rpg-text-dim focus:outline-none focus:border-rpg-accent"
              />
            </div>

            {/* Create Button */}
            <div className="flex items-end">
              <button
                onClick={handleCreateWindow}
                disabled={isCreating || !newWindowName.trim()}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  isCreating || !newWindowName.trim()
                    ? 'bg-rpg-accent/30 text-rpg-accent/50 cursor-not-allowed'
                    : 'bg-rpg-accent hover:bg-rpg-accent/80 text-rpg-bg'
                }`}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>

          {createError && (
            <p className="text-xs text-rpg-error">{createError}</p>
          )}
        </div>
      )}

      {/* Main content - dimmed when disconnected */}
      <div className={!connected ? 'opacity-60 pointer-events-none' : undefined}>
        {/* Empty state */}
        {windowGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-rpg-text-muted">
            {!connected ? (
              <>
                <p className="text-lg mb-2">Server not connected</p>
                <p className="text-sm text-rpg-text-dim">Start the server with: npm run dev</p>
              </>
            ) : (
              <>
                <p className="text-lg mb-2">No tmux panes found</p>
                <p className="text-sm text-rpg-text-dim">Start Claude Code in a tmux session to begin!</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {windowGroups.map(group => (
              <WindowSection
                key={group.window.id}
                group={group}
                collapsed={collapsedWindows.has(group.window.id)}
                maxPanes={MAX_PANES_PER_WINDOW}
                onToggleWindow={() => toggleWindow(group.window.id)}
                onNewPane={onNewPane}
                onNewClaude={onNewClaude}
                onRenameWindow={onRenameWindow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

interface WindowSectionProps {
  group: WindowGroup
  collapsed: boolean
  maxPanes: number
  onToggleWindow: () => void
  onNewPane: (windowId: string) => void
  onNewClaude: (windowId: string) => void
  onRenameWindow: (windowId: string, windowName: string) => Promise<{ ok: boolean; error?: string }>
}

const WindowSection = memo(function WindowSection({
  group,
  collapsed,
  maxPanes,
  onToggleWindow,
  onNewPane,
  onNewClaude,
  onRenameWindow,
}: WindowSectionProps) {
  const hasAttention = group.attentionCount > 0
  const canAddPane = group.panes.length < maxPanes

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleStartRename = () => {
    setRenameValue(group.window.windowName)
    setRenameError(null)
    setIsRenaming(true)
  }

  const handleConfirmRename = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenameError('Name is required')
      return
    }
    if (trimmed === group.window.windowName) {
      setIsRenaming(false)
      return
    }
    const result = await onRenameWindow(group.window.id, trimmed)
    if (result.ok) {
      setIsRenaming(false)
      setRenameError(null)
    } else {
      setRenameError(result.error || 'Failed to rename')
    }
  }

  const handleCancelRename = () => {
    setIsRenaming(false)
    setRenameError(null)
  }

  const handleNewPane = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onNewPane(group.window.id)
  }, [onNewPane, group.window.id])

  const handleNewClaude = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onNewClaude(group.window.id)
  }, [onNewClaude, group.window.id])

  const handleStartRenameClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    handleStartRename()
  }, [])

  return (
    <div className={`rounded-lg border ${hasAttention ? 'border-rpg-waiting status-bg-waiting' : 'border-rpg-border'}`}>
      {/* Window header */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg">
        <button
          onClick={onToggleWindow}
          className="flex-1 flex items-center gap-2 text-left transition-colors hover:bg-rpg-card-hover rounded px-1 -ml-1"
        >
          <span className="w-6 h-6 flex items-center justify-center text-xs rounded bg-rpg-card text-rpg-text-muted font-mono">
            {group.window.windowIndex}
          </span>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleConfirmRename() }
                if (e.key === 'Escape') { e.preventDefault(); handleCancelRename() }
              }}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-sm text-rpg-text bg-rpg-bg-elevated border border-rpg-accent rounded px-1 py-0.5 w-32 focus:outline-none"
            />
          ) : (
            <span className="font-medium text-sm text-rpg-text">
              {group.window.windowName}
            </span>
          )}
          {group.primaryRepo && (
            <span className="text-xs text-rpg-accent truncate max-w-[200px] hidden sm:inline">
              {group.primaryRepo}
            </span>
          )}
          <span className="text-xs text-rpg-text-dim hidden sm:inline">
            {group.window.sessionName}
          </span>
          {hasAttention && (
            <span className="px-1.5 py-0.5 rounded status-bg-waiting text-rpg-waiting text-xs">
              {group.attentionCount}
            </span>
          )}
          <span className="text-xs text-rpg-text-dim ml-auto">
            {group.panes.length}/{maxPanes}
          </span>
          <span className="text-rpg-text-dim text-xs">
            {collapsed ? '▶' : '▼'}
          </span>
        </button>

        {/* Window-level actions */}
        <div className="flex items-center gap-1">
          {isRenaming ? (
            <>
              <button
                onClick={handleConfirmRename}
                className="px-2 py-1 text-xs rounded bg-rpg-accent/20 hover:bg-rpg-accent/30 text-rpg-accent transition-colors"
                title="Confirm rename"
              >
                OK
              </button>
              <button
                onClick={handleCancelRename}
                className="px-2 py-1 text-xs rounded bg-rpg-bg-elevated hover:bg-rpg-border text-rpg-text-muted transition-colors"
                title="Cancel rename"
              >
                Esc
              </button>
            </>
          ) : (
            <>
              <ActionButton icon="✏️" label="Rename" variant="ghost" onClick={handleStartRenameClick} />
              <ActionButton
                icon="+"
                label="New Pane"
                shortLabel="Pane"
                disabled={!canAddPane}
                onClick={handleNewPane}
                title={canAddPane ? 'Add new shell pane' : `Maximum ${maxPanes} panes`}
              />
              <ActionButton
                icon="⚡"
                label="New Claude"
                shortLabel="Claude"
                variant="accent"
                disabled={!canAddPane}
                onClick={handleNewClaude}
                title={canAddPane ? 'Add new Claude pane' : `Maximum ${maxPanes} panes`}
              />
            </>
          )}
        </div>
      </div>

      {/* Rename error */}
      {renameError && (
        <div className="px-3 pb-1">
          <p className="text-xs text-rpg-error">{renameError}</p>
        </div>
      )}

      {/* Panes */}
      {!collapsed && (
        <div className="px-2 pb-2 space-y-2">
          {group.panes.map(pane => (
            <PaneCard
              key={pane.id}
              pane={pane}
              window={group.window}
            />
          ))}
        </div>
      )}
    </div>
  )
})
