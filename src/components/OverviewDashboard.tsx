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
  sortPriority: number
}

type SectionType = 'attention' | 'working' | 'idle'

interface Section {
  type: SectionType
  title: string
  panes: PaneWithWindow[]
  collapsed: boolean
}

function getPaneSection(pane: TmuxPane): SectionType {
  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession

  // Attention: Claude waiting for input, has question, or error
  if (isClaudePane && session) {
    if (session.status === 'waiting' || session.status === 'error' || session.pendingQuestion) {
      return 'attention'
    }
    // Working: Claude actively typing or working
    if (session.status === 'typing' || session.status === 'working') {
      return 'working'
    }
  }

  // Working: Non-Claude process running (not shell)
  if (pane.process.type === 'process') {
    return 'working'
  }

  // Working: Shell with typing activity
  if (pane.process.typing) {
    return 'working'
  }

  // Idle: Everything else (idle Claude, shells)
  return 'idle'
}

const sectionConfig: Record<SectionType, { title: string; icon: string }> = {
  attention: { title: 'Needs Attention', icon: '!' },
  working: { title: 'Working', icon: '▶' },
  idle: { title: 'Idle', icon: '○' },
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
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionType>>(new Set())

  // Group panes into sections while maintaining stable order within each
  const { sections, stats } = useMemo(() => {
    const allPanes: PaneWithWindow[] = []
    let claudeCount = 0
    let windowIndex = 0

    for (const window of windows) {
      for (const pane of window.panes) {
        if (pane.process.type === 'claude') claudeCount++
        allPanes.push({
          ...pane,
          window,
          sortPriority: windowIndex * 100 + pane.paneIndex,
        })
      }
      windowIndex++
    }

    // Sort by window/pane position for stable ordering
    allPanes.sort((a, b) => a.sortPriority - b.sortPriority)

    // Group into sections
    const grouped: Record<SectionType, PaneWithWindow[]> = {
      attention: [],
      working: [],
      idle: [],
    }

    for (const pane of allPanes) {
      const section = getPaneSection(pane)
      grouped[section].push(pane)
    }

    // Build sections array in priority order
    const sectionOrder: SectionType[] = ['attention', 'working', 'idle']
    const sectionsResult: Section[] = sectionOrder
      .filter(type => grouped[type].length > 0)
      .map(type => ({
        type,
        title: sectionConfig[type].title,
        panes: grouped[type],
        collapsed: collapsedSections.has(type),
      }))

    return {
      sections: sectionsResult,
      stats: {
        total: allPanes.length,
        claude: claudeCount,
        windows: windows.length,
      },
    }
  }, [windows, collapsedSections])

  const toggleSection = (type: SectionType) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header: stats left, pro toggle + connection right */}
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
                : 'bg-rpg-card text-rpg-idle hover:text-white'
            }`}
            title={proMode ? "Show Bitcoin faces" : "Hide Bitcoin faces"}
          >
            {proMode ? 'Pro' : '😎'}
          </button>
          <ConnectionStatus connected={connected} />
        </div>
      </div>

      {/* Empty state */}
      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-rpg-idle">
          <p className="text-lg mb-2">No tmux panes found</p>
          <p className="text-sm text-rpg-idle/70">Start Claude Code in a tmux session to begin!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map(section => (
            <DashboardSection
              key={section.type}
              section={section}
              proMode={proMode}
              onToggleCollapse={() => toggleSection(section.type)}
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DashboardSectionProps {
  section: Section
  proMode: boolean
  onToggleCollapse: () => void
  onSendPrompt: (paneId: string, prompt: string) => void
  onSendSignal: (paneId: string, signal: string) => void
}

function DashboardSection({
  section,
  proMode,
  onToggleCollapse,
  onSendPrompt,
  onSendSignal,
}: DashboardSectionProps) {
  const config = sectionConfig[section.type]
  const isAttention = section.type === 'attention'
  const isIdle = section.type === 'idle'

  return (
    <div className={`rounded-lg ${isAttention ? 'bg-rpg-waiting/5 border border-rpg-waiting/30' : ''}`}>
      {/* Section header */}
      <button
        onClick={onToggleCollapse}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors rounded-t-lg ${
          isAttention
            ? 'text-rpg-waiting hover:bg-rpg-waiting/10'
            : isIdle
            ? 'text-rpg-idle/70 hover:bg-rpg-card/50'
            : 'text-white/80 hover:bg-rpg-card/50'
        }`}
      >
        <span className={`w-5 h-5 flex items-center justify-center text-xs rounded ${
          isAttention ? 'bg-rpg-waiting/20 text-rpg-waiting font-bold' : 'bg-rpg-card text-rpg-idle'
        }`}>
          {config.icon}
        </span>
        <span className={`font-medium text-sm ${isAttention ? 'text-rpg-waiting' : ''}`}>
          {config.title}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          isAttention ? 'bg-rpg-waiting/20 text-rpg-waiting' : 'bg-rpg-card text-rpg-idle'
        }`}>
          {section.panes.length}
        </span>
        <span className="ml-auto text-rpg-idle/50 text-xs">
          {section.collapsed ? '▶' : '▼'}
        </span>
      </button>

      {/* Section content */}
      {!section.collapsed && (
        <div className={`space-y-2 ${isAttention ? 'px-2 pb-2' : 'px-0'}`}>
          {section.panes.map(pane => (
            <PaneCard
              key={pane.id}
              pane={pane}
              window={pane.window}
              onSendPrompt={onSendPrompt}
              onSendSignal={onSendSignal}
              proMode={proMode}
              compact={isIdle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
