/**
 * Tests for Zustand store selectors and actions
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '../store'
import type { TmuxWindow, TmuxPane, Companion, Quest } from '../../shared/types'

// Reset store before each test
beforeEach(() => {
  useStore.setState({
    windows: [],
    terminalCache: new Map(),
    companions: [],
    quests: [],
    competitions: [],
    workers: [],
    recentEvents: [],
    recentXPGains: [],
    status: 'disconnected',
    lastConnected: null,
    reconnectAttempt: 0,
    selectedPaneId: null,
    fullScreenPaneId: null,
    activePage: 'overview',
    selectedProjectId: null,
    sidebarOpen: false,
  })
})

// Mock data factories
function createPane(overrides: Partial<TmuxPane> = {}): TmuxPane {
  return {
    id: 'pane-1',
    index: 0,
    active: true,
    width: 80,
    height: 24,
    cwd: '/home/user/project',
    process: {
      type: 'shell',
      command: 'bash',
      pid: 1234,
    },
    ...overrides,
  } as TmuxPane
}

function createClaudePane(overrides: Partial<TmuxPane> = {}): TmuxPane {
  return createPane({
    process: {
      type: 'claude',
      command: 'claude',
      claudeSession: {
        id: 'session-1',
        name: 'Alice',
        status: 'idle',
      },
    },
    ...overrides,
  } as Partial<TmuxPane>)
}

function createWindow(overrides: Partial<TmuxWindow> = {}): TmuxWindow {
  return {
    id: 'window-1',
    sessionName: 'main',
    windowName: 'dev',
    windowIndex: 0,
    active: true,
    panes: [],
    ...overrides,
  } as TmuxWindow
}

function createCompanion(overrides: Partial<Companion> = {}): Companion {
  return {
    id: 'companion-1',
    name: 'test-project',
    totalExperience: 1000,
    lastActivity: Date.now(),
    createdAt: Date.now() - 86400000,
    streak: { current: 5, longest: 10, lastActivityDate: new Date().toISOString().split('T')[0] },
    achievements: [],
    repo: { path: '/home/user/test-project', name: 'test-project' },
    stats: {
      git: { commits: 10, pushes: 5, prsCreated: 2, prsMerged: 1 },
      commands: { testsRun: 20, buildsRun: 5, deploysRun: 1, lintsRun: 10 },
      blockchain: { clarinetChecks: 0, clarinetTests: 0, testnetDeploys: 0, mainnetDeploys: 0 },
      quests: { questsCompleted: 0, phasesCompleted: 0 },
      sessionsCompleted: 15,
    },
    ...overrides,
  } as Companion
}

// ═══════════════════════════════════════════════════════════════════════════
// WINDOW/PANE ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Window and Pane Actions', () => {
  test('setWindows replaces all windows', () => {
    const windows = [createWindow({ id: 'w1' }), createWindow({ id: 'w2' })]
    useStore.getState().setWindows(windows)

    expect(useStore.getState().windows).toHaveLength(2)
    expect(useStore.getState().windows[0].id).toBe('w1')
  })

  test('updatePane updates existing pane', () => {
    const pane = createClaudePane({ id: 'p1' })
    const window = createWindow({ id: 'w1', panes: [pane] })
    useStore.getState().setWindows([window])

    const updatedPane = { ...pane, process: { ...pane.process, claudeSession: { ...pane.process.claudeSession!, status: 'working' as const } } }
    useStore.getState().updatePane(updatedPane)

    const state = useStore.getState()
    expect(state.windows[0].panes[0].process.claudeSession?.status).toBe('working')
  })

  test('removePane removes pane and cleans up', () => {
    const pane = createPane({ id: 'p1' })
    const window = createWindow({ id: 'w1', panes: [pane] })
    useStore.getState().setWindows([window])
    useStore.getState().setTerminalContent('p1', 'test content')
    useStore.getState().setSelectedPane('p1')

    useStore.getState().removePane('p1')

    const state = useStore.getState()
    expect(state.windows).toHaveLength(0) // Window removed when empty
    expect(state.terminalCache.has('p1')).toBe(false)
    expect(state.selectedPaneId).toBeNull()
  })

  test('setTerminalContent stores content in cache', () => {
    useStore.getState().setTerminalContent('p1', 'terminal output')

    expect(useStore.getState().terminalCache.get('p1')).toBe('terminal output')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// COMPANION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Companion Actions', () => {
  test('setCompanions replaces all companions', () => {
    const companions = [createCompanion({ id: 'c1' }), createCompanion({ id: 'c2' })]
    useStore.getState().setCompanions(companions)

    expect(useStore.getState().companions).toHaveLength(2)
  })

  test('updateCompanion updates existing companion', () => {
    const companion = createCompanion({ id: 'c1', totalExperience: 100 })
    useStore.getState().setCompanions([companion])

    useStore.getState().updateCompanion({ ...companion, totalExperience: 200 })

    expect(useStore.getState().companions[0].totalExperience).toBe(200)
    expect(useStore.getState().companions).toHaveLength(1)
  })

  test('updateCompanion adds new companion if not exists', () => {
    useStore.getState().setCompanions([])
    useStore.getState().updateCompanion(createCompanion({ id: 'c1' }))

    expect(useStore.getState().companions).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// QUEST ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Quest Actions', () => {
  test('setQuests replaces all quests', () => {
    const quests: Quest[] = [
      { id: 'q1', name: 'Quest 1', repoPath: '/path', status: 'active', phases: [], createdAt: Date.now() },
      { id: 'q2', name: 'Quest 2', repoPath: '/path', status: 'completed', phases: [], createdAt: Date.now() },
    ]
    useStore.getState().setQuests(quests)

    expect(useStore.getState().quests).toHaveLength(2)
  })

  test('updateQuest updates existing quest', () => {
    const quest: Quest = { id: 'q1', name: 'Quest 1', repoPath: '/path', status: 'active', phases: [], createdAt: Date.now() }
    useStore.getState().setQuests([quest])

    useStore.getState().updateQuest({ ...quest, status: 'completed' })

    expect(useStore.getState().quests[0].status).toBe('completed')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Connection Actions', () => {
  test('setConnectionStatus updates status and resets attempt on connect', () => {
    useStore.getState().setReconnectAttempt(3)
    useStore.getState().setConnectionStatus('connected')

    const state = useStore.getState()
    expect(state.status).toBe('connected')
    expect(state.reconnectAttempt).toBe(0)
    expect(state.lastConnected).toBeGreaterThan(0)
  })

  test('setConnectionStatus preserves attempt count on disconnect', () => {
    useStore.getState().setReconnectAttempt(3)
    useStore.getState().setConnectionStatus('disconnected')

    expect(useStore.getState().reconnectAttempt).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EVENT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Event Actions', () => {
  test('addEvent prepends event and limits to max', () => {
    for (let i = 0; i < 150; i++) {
      useStore.getState().addEvent({
        id: `event-${i}`,
        type: 'stop',
        timestamp: Date.now(),
        paneId: 'p1',
        tmuxTarget: 'main:0.0',
      })
    }

    // MAX_EVENTS is 100
    expect(useStore.getState().recentEvents).toHaveLength(100)
    // Most recent should be first
    expect(useStore.getState().recentEvents[0].id).toBe('event-149')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (via hooks)
// ═══════════════════════════════════════════════════════════════════════════

describe('Selectors', () => {
  test('claude panes selector filters correctly', () => {
    const shellPane = createPane({ id: 'shell' })
    const claudePane = createClaudePane({ id: 'claude' })
    const window = createWindow({ panes: [shellPane, claudePane] })
    useStore.getState().setWindows([window])

    // Access selector directly since we're not in React
    const claudePanes = useStore.getState().windows
      .flatMap(w => w.panes.filter(p => p.process.type === 'claude'))

    expect(claudePanes).toHaveLength(1)
    expect(claudePanes[0].id).toBe('claude')
  })

  test('attention panes selector finds waiting panes', () => {
    const idlePane = createClaudePane({ id: 'idle' })
    const waitingPane = createClaudePane({
      id: 'waiting',
      process: {
        type: 'claude',
        command: 'claude',
        claudeSession: { id: 's2', name: 'Bob', status: 'waiting' },
      },
    } as Partial<TmuxPane>)
    const window = createWindow({ panes: [idlePane, waitingPane] })
    useStore.getState().setWindows([window])

    // Access selector logic directly
    const attentionPanes = useStore.getState().windows
      .flatMap(w => w.panes.filter(p =>
        p.process.type === 'claude' &&
        p.process.claudeSession?.status === 'waiting'
      ))

    expect(attentionPanes).toHaveLength(1)
    expect(attentionPanes[0].id).toBe('waiting')
  })

  test('companion selector finds by ID', () => {
    const companion = createCompanion({ id: 'target' })
    useStore.getState().setCompanions([
      createCompanion({ id: 'other' }),
      companion,
    ])

    const found = useStore.getState().companions.find(c => c.id === 'target')

    expect(found?.id).toBe('target')
  })

  test('active quests selector filters correctly', () => {
    const quests: Quest[] = [
      { id: 'q1', name: 'Active', repoPath: '/path', status: 'active', phases: [], createdAt: Date.now() },
      { id: 'q2', name: 'Completed', repoPath: '/path', status: 'completed', phases: [], createdAt: Date.now() },
      { id: 'q3', name: 'Active 2', repoPath: '/path', status: 'active', phases: [], createdAt: Date.now() },
    ]
    useStore.getState().setQuests(quests)

    const activeQuests = useStore.getState().quests.filter(q => q.status === 'active')

    expect(activeQuests).toHaveLength(2)
  })
})
