import { useMemo, useState } from 'react'
import type { TmuxWindow, TmuxPane } from '@shared/types'
import { PaneCard } from './PaneCard'
import { ConnectionStatus } from './ConnectionStatus'

interface OverviewDashboardProps {
  windows: TmuxWindow[]
  attentionCount: number
  connected: boolean
  proMode: boolean
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
  onToggleProMode: () => void
}

interface PaneWithWindow extends TmuxPane {
  window: TmuxWindow
}

interface ProjectGroup {
  key: string // "org/repo" or "no-project"
  label: string
  panes: PaneWithWindow[]
  attentionCount: number
}

interface WindowGroup {
  window: TmuxWindow
  projects: ProjectGroup[]
  attentionCount: number
}

function getProjectKey(pane: TmuxPane): string {
  if (!pane.repo) return 'no-project'
  return pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name
}

function getProjectLabel(pane: TmuxPane): string {
  if (!pane.repo) return 'Other'
  return pane.repo.org ? `${pane.repo.org}/${pane.repo.name}` : pane.repo.name
}

function needsAttention(pane: TmuxPane): boolean {
  if (pane.process.type !== 'claude') return false
  const session = pane.process.claudeSession
  if (!session) return false
  return session.status === 'waiting' || session.status === 'error' || !!session.pendingQuestion
}

export function OverviewDashboard({
  windows,
  attentionCount,
  connected,
  proMode,
  onSendPrompt,
  onSendSignal,
  onToggleProMode,
}: OverviewDashboardProps) {
  const [collapsedWindows, setCollapsedWindows] = useState<Set<string>>(new Set())
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  // Group panes by window, then by project
  const { windowGroups, stats } = useMemo(() => {
    const groups: WindowGroup[] = []
    let totalPanes = 0
    let claudeCount = 0

    for (const window of windows) {
      // Group panes in this window by project
      const projectMap = new Map<string, PaneWithWindow[]>()

      for (const pane of window.panes) {
        totalPanes++
        if (pane.process.type === 'claude') claudeCount++

        const key = getProjectKey(pane)
        if (!projectMap.has(key)) {
          projectMap.set(key, [])
        }
        projectMap.get(key)!.push({ ...pane, window })
      }

      // Convert to ProjectGroup array, sorted: projects with attention first, then alphabetically
      const projects: ProjectGroup[] = Array.from(projectMap.entries())
        .map(([key, panes]) => ({
          key,
          label: panes[0].repo ? getProjectLabel(panes[0]) : 'Other',
          panes,
          attentionCount: panes.filter(needsAttention).length,
        }))
        .sort((a, b) => {
          // Attention items first
          if (a.attentionCount > 0 && b.attentionCount === 0) return -1
          if (b.attentionCount > 0 && a.attentionCount === 0) return 1
          // Then "Other" last
          if (a.key === 'no-project') return 1
          if (b.key === 'no-project') return -1
          // Then alphabetically
          return a.label.localeCompare(b.label)
        })

      const windowAttention = projects.reduce((sum, p) => sum + p.attentionCount, 0)

      groups.push({
        window,
        projects,
        attentionCount: windowAttention,
      })
    }

    // Sort windows: those with attention first, then by window index
    groups.sort((a, b) => {
      if (a.attentionCount > 0 && b.attentionCount === 0) return -1
      if (b.attentionCount > 0 && a.attentionCount === 0) return 1
      return a.window.windowIndex - b.window.windowIndex
    })

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

  const toggleProject = (projectKey: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectKey)) {
        next.delete(projectKey)
      } else {
        next.add(projectKey)
      }
      return next
    })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-rpg-idle">
            {stats.windows} Window{stats.windows !== 1 ? 's' : ''} / {stats.total} Pane{stats.total !== 1 ? 's' : ''}
          </span>
          {attentionCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-rpg-waiting/20 text-rpg-waiting text-xs font-medium animate-pulse">
              {attentionCount} need{attentionCount !== 1 ? '' : 's'} attention
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleProMode}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              proMode
                ? 'bg-rpg-accent/20 text-rpg-accent'
                : 'bg-rpg-card text-rpg-idle hover:text-rpg-text'
            }`}
            title={proMode ? "Show Bitcoin faces" : "Hide Bitcoin faces"}
          >
            {proMode ? 'Pro' : '😎'}
          </button>
          <ConnectionStatus connected={connected} />
        </div>
      </div>

      {/* Empty state */}
      {windowGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-rpg-idle">
          <p className="text-lg mb-2">No tmux panes found</p>
          <p className="text-sm text-rpg-idle/70">Start Claude Code in a tmux session to begin!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {windowGroups.map(group => (
            <WindowSection
              key={group.window.id}
              group={group}
              collapsed={collapsedWindows.has(group.window.id)}
              collapsedProjects={collapsedProjects}
              proMode={proMode}
              onToggleWindow={() => toggleWindow(group.window.id)}
              onToggleProject={toggleProject}
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
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
  collapsedProjects: Set<string>
  proMode: boolean
  onToggleWindow: () => void
  onToggleProject: (key: string) => void
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
}

function WindowSection({
  group,
  collapsed,
  collapsedProjects,
  proMode,
  onToggleWindow,
  onToggleProject,
  onSendPrompt,
  onSendSignal,
}: WindowSectionProps) {
  const hasAttention = group.attentionCount > 0
  const hasMultipleProjects = group.projects.length > 1 || (group.projects.length === 1 && group.projects[0].key !== 'no-project')

  return (
    <div className={`rounded-lg border ${hasAttention ? 'border-rpg-waiting/50 bg-rpg-waiting/5' : 'border-rpg-border/50'}`}>
      {/* Window header */}
      <button
        onClick={onToggleWindow}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors rounded-t-lg hover:bg-rpg-card/50`}
      >
        <span className="w-6 h-6 flex items-center justify-center text-xs rounded bg-rpg-card text-rpg-idle font-mono">
          {group.window.windowIndex}
        </span>
        <span className="font-medium text-sm text-rpg-text/90">
          {group.window.windowName}
        </span>
        <span className="text-xs text-rpg-idle/60">
          {group.window.sessionName}
        </span>
        {hasAttention && (
          <span className="px-1.5 py-0.5 rounded bg-rpg-waiting/20 text-rpg-waiting text-xs">
            {group.attentionCount}
          </span>
        )}
        <span className="text-xs text-rpg-idle/50 ml-auto">
          {group.projects.reduce((sum, p) => sum + p.panes.length, 0)} pane{group.projects.reduce((sum, p) => sum + p.panes.length, 0) !== 1 ? 's' : ''}
        </span>
        <span className="text-rpg-idle/50 text-xs">
          {collapsed ? '▶' : '▼'}
        </span>
      </button>

      {/* Window content */}
      {!collapsed && (
        <div className="px-2 pb-2 space-y-2">
          {hasMultipleProjects ? (
            // Show project subgroups
            group.projects.map(project => (
              <ProjectSection
                key={`${group.window.id}-${project.key}`}
                project={project}
                windowId={group.window.id}
                collapsed={collapsedProjects.has(`${group.window.id}-${project.key}`)}
                proMode={proMode}
                onToggle={() => onToggleProject(`${group.window.id}-${project.key}`)}
                onSendPrompt={onSendPrompt}
                onSendSignal={onSendSignal}
              />
            ))
          ) : (
            // Single project or no-project: show panes directly
            group.projects.flatMap(project =>
              project.panes.map(pane => (
                <PaneCard
                  key={pane.id}
                  pane={pane}
                  window={pane.window}
                  onSendPrompt={onSendPrompt}
                  onSendSignal={onSendSignal}
                  proMode={proMode}
                />
              ))
            )
          )}
        </div>
      )}
    </div>
  )
}

interface ProjectSectionProps {
  project: ProjectGroup
  windowId: string
  collapsed: boolean
  proMode: boolean
  onToggle: () => void
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
}

function ProjectSection({
  project,
  collapsed,
  proMode,
  onToggle,
  onSendPrompt,
  onSendSignal,
}: ProjectSectionProps) {
  const hasAttention = project.attentionCount > 0

  return (
    <div className={`rounded-lg ${hasAttention ? 'bg-rpg-waiting/10' : 'bg-rpg-card/30'}`}>
      {/* Project header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors rounded-t-lg hover:bg-rpg-card/50"
      >
        <span className="text-rpg-accent text-sm">
          {project.label}
        </span>
        {hasAttention && (
          <span className="px-1.5 py-0.5 rounded bg-rpg-waiting/20 text-rpg-waiting text-xs">
            {project.attentionCount}
          </span>
        )}
        <span className="text-xs text-rpg-idle/50 ml-auto">
          {project.panes.length}
        </span>
        <span className="text-rpg-idle/30 text-xs">
          {collapsed ? '▶' : '▼'}
        </span>
      </button>

      {/* Project panes */}
      {!collapsed && (
        <div className="px-2 pb-2 space-y-2">
          {project.panes.map(pane => (
            <PaneCard
              key={pane.id}
              pane={pane}
              window={pane.window}
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
              proMode={proMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
