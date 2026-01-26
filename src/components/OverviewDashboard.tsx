import { useMemo, useState, memo } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'
import { PaneCard } from './PaneCard'
import { ConnectionBanner, ConnectionDot } from './ConnectionStatus'
import { BackendSelector } from './BackendSelector'

// Maximum panes per window (must match server constant)
const MAX_PANES_PER_WINDOW = 4

interface OverviewDashboardProps {
  windows: TmuxWindow[]
  attentionCount: number
  connected: boolean
  rpgEnabled?: boolean
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting: (paneId: string) => void
  onExpandPane: (paneId: string) => void
  onRefreshPane: (paneId: string) => void
  onClosePane: (paneId: string) => void
  onNewPane: (windowId: string) => void
  onNewClaude: (windowId: string) => void
  onCreateWindow: (sessionName: string, windowName: string) => Promise<boolean>
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
  rpgEnabled = true,
  onSendPrompt,
  onSendSignal,
  onDismissWaiting,
  onExpandPane,
  onRefreshPane,
  onClosePane,
  onNewPane,
  onNewClaude,
  onCreateWindow,
  onNavigateToCompetitions,
}: OverviewDashboardProps) {
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

  const toggleWindow = (windowId: string) => {
    setCollapsedWindows(prev => {
      const next = new Set(prev)
      if (next.has(windowId)) {
        next.delete(windowId)
      } else {
        next.add(windowId)
      }
      return next
    })
  }

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
        <div className="flex items-center gap-2 flex-wrap">
          {sessions.length > 0 && (
            <button
              onClick={handleOpenCreateWindow}
              className="px-2 py-1 text-xs rounded bg-rpg-accent/20 hover:bg-rpg-accent/30 text-rpg-accent transition-colors"
              title="Create new window"
            >
              +Win
            </button>
          )}
          {windowGroups.length > 1 && (
            <button
              onClick={toggleAllWindows}
              className="px-2 py-1 text-xs rounded bg-rpg-card text-rpg-text-muted hover:text-rpg-text hover:bg-rpg-card-hover transition-colors"
              title={allCollapsed ? 'Expand all windows' : 'Collapse all windows'}
            >
              {allCollapsed ? '▼' : '▲'}
            </button>
          )}
          {rpgEnabled && (
            <button
              onClick={onNavigateToCompetitions}
              className="px-2 py-1 text-xs rounded bg-rpg-card text-rpg-text-muted hover:text-rpg-accent hover:bg-rpg-card-hover transition-colors hidden sm:block"
              title="View Competitions"
            >
              LB
            </button>
          )}
          <BackendSelector />
          <ConnectionDot connected={connected} />
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
                rpgEnabled={rpgEnabled}
                onToggleWindow={() => toggleWindow(group.window.id)}
                onSendPrompt={onSendPrompt}
                onSendSignal={onSendSignal}
                onDismissWaiting={onDismissWaiting}
                onExpandPane={onExpandPane}
                onRefreshPane={onRefreshPane}
                onClosePane={onClosePane}
                onNewPane={onNewPane}
                onNewClaude={onNewClaude}
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
  rpgEnabled?: boolean
  onToggleWindow: () => void
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting: (paneId: string) => void
  onExpandPane: (paneId: string) => void
  onRefreshPane: (paneId: string) => void
  onClosePane: (paneId: string) => void
  onNewPane: (windowId: string) => void
  onNewClaude: (windowId: string) => void
}

const WindowSection = memo(function WindowSection({
  group,
  collapsed,
  maxPanes,
  rpgEnabled = true,
  onToggleWindow,
  onSendPrompt,
  onSendSignal,
  onDismissWaiting,
  onExpandPane,
  onRefreshPane,
  onClosePane,
  onNewPane,
  onNewClaude,
}: WindowSectionProps) {
  const hasAttention = group.attentionCount > 0
  const canAddPane = group.panes.length < maxPanes

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
          <span className="font-medium text-sm text-rpg-text">
            {group.window.windowName}
          </span>
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
          <button
            onClick={() => onNewPane(group.window.id)}
            disabled={!canAddPane}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              canAddPane
                ? 'bg-rpg-bg-elevated hover:bg-rpg-border text-rpg-text-muted hover:text-rpg-text'
                : 'bg-rpg-bg-elevated/50 text-rpg-text-dim cursor-not-allowed'
            }`}
            title={canAddPane ? 'Add new shell pane' : `Maximum ${maxPanes} panes`}
          >
            +Pane
          </button>
          <button
            onClick={() => onNewClaude(group.window.id)}
            disabled={!canAddPane}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              canAddPane
                ? 'bg-rpg-accent/20 hover:bg-rpg-accent/30 text-rpg-accent'
                : 'bg-rpg-accent/10 text-rpg-accent/50 cursor-not-allowed'
            }`}
            title={canAddPane ? 'Add new Claude pane' : `Maximum ${maxPanes} panes`}
          >
            +Claude
          </button>
        </div>
      </div>

      {/* Panes */}
      {!collapsed && (
        <div className="px-2 pb-2 space-y-2">
          {group.panes.map(pane => (
            <PaneCard
              key={pane.id}
              pane={pane}
              window={group.window}
              rpgEnabled={rpgEnabled}
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
              onDismissWaiting={onDismissWaiting}
              onExpandPane={onExpandPane}
              onRefreshPane={onRefreshPane}
              onClosePane={onClosePane}
            />
          ))}
        </div>
      )}
    </div>
  )
})
