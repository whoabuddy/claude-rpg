import { useMemo, useState, memo } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'
import { PaneCard } from './PaneCard'
import { ConnectionStatus } from './ConnectionStatus'

// Maximum panes per window (must match server constant)
const MAX_PANES_PER_WINDOW = 4

interface OverviewDashboardProps {
  windows: TmuxWindow[]
  attentionCount: number
  connected: boolean
  proMode: boolean
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting: (paneId: string) => void
  onExpandPane: (paneId: string) => void
  onRefreshPane: (paneId: string) => void
  onClosePane: (paneId: string) => void
  onNewPane: (windowId: string) => void
  onNewClaude: (windowId: string) => void
  onToggleProMode: () => void
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

export function OverviewDashboard({
  windows,
  attentionCount,
  connected,
  proMode,
  onSendPrompt,
  onSendSignal,
  onDismissWaiting,
  onExpandPane,
  onRefreshPane,
  onClosePane,
  onNewPane,
  onNewClaude,
  onToggleProMode,
  onNavigateToCompetitions,
}: OverviewDashboardProps) {
  const [collapsedWindows, setCollapsedWindows] = useState<Set<string>>(new Set())

  // Group panes by window, sort panes by attention first
  const { windowGroups, stats } = useMemo(() => {
    const groups: WindowGroup[] = []
    let totalPanes = 0
    let claudeCount = 0

    for (const window of windows) {
      const panes = [...window.panes]
      totalPanes += panes.length

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

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-rpg-text-muted">
            {stats.windows} Window{stats.windows !== 1 ? 's' : ''} / {stats.total} Pane{stats.total !== 1 ? 's' : ''}
          </span>
          {attentionCount > 0 && (
            <span className="px-2 py-0.5 rounded status-bg-waiting text-rpg-waiting text-xs font-medium animate-pulse">
              {attentionCount} need{attentionCount !== 1 ? '' : 's'} attention
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {windowGroups.length > 1 && (
            <button
              onClick={toggleAllWindows}
              className="px-2 py-1 text-xs rounded bg-rpg-card text-rpg-text-muted hover:text-rpg-text hover:bg-rpg-card-hover transition-colors"
              title={allCollapsed ? 'Expand all windows' : 'Collapse all windows'}
            >
              {allCollapsed ? '▼ All' : '▲ All'}
            </button>
          )}
          <button
            onClick={onNavigateToCompetitions}
            className="px-2 py-1 text-xs rounded bg-rpg-card text-rpg-text-muted hover:text-rpg-accent hover:bg-rpg-card-hover transition-colors"
            title="View Competitions"
          >
            Leaderboard
          </button>
          <button
            onClick={onToggleProMode}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              proMode
                ? 'bg-rpg-accent/20 text-rpg-accent'
                : 'bg-rpg-card text-rpg-text-muted hover:text-rpg-text'
            }`}
            title={proMode ? "Show Bitcoin faces" : "Hide Bitcoin faces"}
          >
            {proMode ? 'Pro' : 'RPG'}
          </button>
          <ConnectionStatus connected={connected} />
        </div>
      </div>

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
              proMode={proMode}
              maxPanes={MAX_PANES_PER_WINDOW}
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
  )
}

interface WindowSectionProps {
  group: WindowGroup
  collapsed: boolean
  proMode: boolean
  maxPanes: number
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
  proMode,
  maxPanes,
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
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
              onDismissWaiting={onDismissWaiting}
              onExpandPane={onExpandPane}
              onRefreshPane={onRefreshPane}
              onClosePane={onClosePane}
              proMode={proMode}
            />
          ))}
        </div>
      )}
    </div>
  )
})
