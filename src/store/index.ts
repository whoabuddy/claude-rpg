import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type {
  TmuxWindow,
  TmuxPane,
  Companion,
  Quest,
  ClaudeEvent,
  XPGain,
  Competition,
  ClaudeSessionInfo,
  TerminalOutput,
} from '../../shared/types'

// ═══════════════════════════════════════════════════════════════════════════
// STATE SHAPE
// ═══════════════════════════════════════════════════════════════════════════

export interface PanesState {
  windows: TmuxWindow[]
  terminalCache: Map<string, string> // paneId -> content
}

export interface CompanionsState {
  companions: Companion[]
}

export interface QuestsState {
  quests: Quest[]
}

export interface CompetitionsState {
  competitions: Competition[]
}

export interface WorkersState {
  workers: ClaudeSessionInfo[]
}

export interface EventsState {
  recentEvents: ClaudeEvent[]
  recentXPGains: XPGain[]
}

export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected'
  lastConnected: number | null
  reconnectAttempt: number
}

export interface UIState {
  selectedPaneId: string | null
  fullScreenPaneId: string | null
  activePage: 'overview' | 'competitions' | 'quests' | 'workers' | 'project'
  selectedProjectId: string | null
  sidebarOpen: boolean
}

export interface AppState extends
  PanesState,
  CompanionsState,
  QuestsState,
  CompetitionsState,
  WorkersState,
  EventsState,
  ConnectionState,
  UIState {
  // Actions - Panes
  setWindows: (windows: TmuxWindow[]) => void
  updatePane: (pane: TmuxPane) => void
  removePane: (paneId: string) => void
  setTerminalContent: (paneId: string, content: string) => void

  // Actions - Companions
  setCompanions: (companions: Companion[]) => void
  updateCompanion: (companion: Companion) => void

  // Actions - Quests
  setQuests: (quests: Quest[]) => void
  updateQuest: (quest: Quest) => void

  // Actions - Competitions
  setCompetitions: (competitions: Competition[]) => void

  // Actions - Workers
  setWorkers: (workers: ClaudeSessionInfo[]) => void

  // Actions - Events
  addEvent: (event: ClaudeEvent) => void
  addXPGain: (xpGain: XPGain) => void
  setEventHistory: (events: ClaudeEvent[]) => void

  // Actions - Connection
  setConnectionStatus: (status: ConnectionState['status']) => void
  setReconnectAttempt: (attempt: number) => void

  // Actions - UI
  setSelectedPane: (paneId: string | null) => void
  setFullScreenPane: (paneId: string | null) => void
  setActivePage: (page: UIState['activePage']) => void
  setSelectedProject: (projectId: string | null) => void
  toggleSidebar: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

const MAX_EVENTS = 100
const MAX_XP_GAINS = 50

export const useStore = create<AppState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state - Panes
      windows: [],
      terminalCache: new Map(),

      // Initial state - Companions
      companions: [],

      // Initial state - Quests
      quests: [],

      // Initial state - Competitions
      competitions: [],

      // Initial state - Workers
      workers: [],

      // Initial state - Events
      recentEvents: [],
      recentXPGains: [],

      // Initial state - Connection
      status: 'disconnected',
      lastConnected: null,
      reconnectAttempt: 0,

      // Initial state - UI
      selectedPaneId: null,
      fullScreenPaneId: null,
      activePage: 'overview',
      selectedProjectId: null,
      sidebarOpen: false,

      // ═════════════════════════════════════════════════════════════════════
      // PANE ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setWindows: (windows) => set({ windows }, false, 'setWindows'),

      updatePane: (pane) => set((state) => {
        const windows = state.windows.map(window => ({
          ...window,
          panes: window.panes.map(p =>
            p.id === pane.id ? pane : p
          )
        }))
        return { windows }
      }, false, 'updatePane'),

      removePane: (paneId) => set((state) => {
        const windows = state.windows.map(window => ({
          ...window,
          panes: window.panes.filter(p => p.id !== paneId)
        })).filter(window => window.panes.length > 0)

        // Clear from terminal cache
        const terminalCache = new Map(state.terminalCache)
        terminalCache.delete(paneId)

        // Clear selection if removed pane was selected
        const selectedPaneId = state.selectedPaneId === paneId ? null : state.selectedPaneId
        const fullScreenPaneId = state.fullScreenPaneId === paneId ? null : state.fullScreenPaneId

        return { windows, terminalCache, selectedPaneId, fullScreenPaneId }
      }, false, 'removePane'),

      setTerminalContent: (paneId, content) => set((state) => {
        const terminalCache = new Map(state.terminalCache)
        terminalCache.set(paneId, content)
        return { terminalCache }
      }, false, 'setTerminalContent'),

      // ═════════════════════════════════════════════════════════════════════
      // COMPANION ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setCompanions: (companions) => set({ companions }, false, 'setCompanions'),

      updateCompanion: (companion) => set((state) => {
        const exists = state.companions.some(c => c.id === companion.id)
        const companions = exists
          ? state.companions.map(c => c.id === companion.id ? companion : c)
          : [...state.companions, companion]
        return { companions }
      }, false, 'updateCompanion'),

      // ═════════════════════════════════════════════════════════════════════
      // QUEST ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setQuests: (quests) => set({ quests }, false, 'setQuests'),

      updateQuest: (quest) => set((state) => {
        const exists = state.quests.some(q => q.id === quest.id)
        const quests = exists
          ? state.quests.map(q => q.id === quest.id ? quest : q)
          : [...state.quests, quest]
        return { quests }
      }, false, 'updateQuest'),

      // ═════════════════════════════════════════════════════════════════════
      // COMPETITION ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setCompetitions: (competitions) => set({ competitions }, false, 'setCompetitions'),

      // ═════════════════════════════════════════════════════════════════════
      // WORKER ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setWorkers: (workers) => set({ workers }, false, 'setWorkers'),

      // ═════════════════════════════════════════════════════════════════════
      // EVENT ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      addEvent: (event) => set((state) => {
        const recentEvents = [event, ...state.recentEvents].slice(0, MAX_EVENTS)
        return { recentEvents }
      }, false, 'addEvent'),

      addXPGain: (xpGain) => set((state) => {
        const recentXPGains = [xpGain, ...state.recentXPGains].slice(0, MAX_XP_GAINS)
        return { recentXPGains }
      }, false, 'addXPGain'),

      setEventHistory: (events) => set({
        recentEvents: events.slice(0, MAX_EVENTS)
      }, false, 'setEventHistory'),

      // ═════════════════════════════════════════════════════════════════════
      // CONNECTION ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setConnectionStatus: (status) => set((state) => ({
        status,
        lastConnected: status === 'connected' ? Date.now() : state.lastConnected,
        reconnectAttempt: status === 'connected' ? 0 : state.reconnectAttempt
      }), false, 'setConnectionStatus'),

      setReconnectAttempt: (attempt) => set({ reconnectAttempt: attempt }, false, 'setReconnectAttempt'),

      // ═════════════════════════════════════════════════════════════════════
      // UI ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setSelectedPane: (paneId) => set({ selectedPaneId: paneId }, false, 'setSelectedPane'),

      setFullScreenPane: (paneId) => set({ fullScreenPaneId: paneId }, false, 'setFullScreenPane'),

      setActivePage: (page) => set({ activePage: page }, false, 'setActivePage'),

      setSelectedProject: (projectId) => set({ selectedProjectId: projectId }, false, 'setSelectedProject'),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar'),
    })),
    { name: 'claude-rpg' }
  )
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTOR HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Get all Claude panes across all windows
export const useClaudePanes = () => useStore((state) =>
  state.windows.flatMap(w => w.panes.filter(p => p.process.type === 'claude'))
)

// Get panes that need attention (waiting status)
export const useAttentionPanes = () => useStore((state) =>
  state.windows.flatMap(w => w.panes.filter(p =>
    p.process.type === 'claude' &&
    p.process.claudeSession?.status === 'waiting'
  ))
)

// Get companion by ID
export const useCompanion = (id: string) => useStore((state) =>
  state.companions.find(c => c.id === id)
)

// Get companion for a pane (by repo path)
export const useCompanionForPane = (pane: TmuxPane | undefined) => useStore((state) => {
  if (!pane?.repo) return undefined
  return state.companions.find(c => c.repo.path === pane.repo?.path)
})

// Get active quests
export const useActiveQuests = () => useStore((state) =>
  state.quests.filter(q => q.status === 'active')
)

// Get terminal content for a pane
export const useTerminalContent = (paneId: string) => useStore((state) =>
  state.terminalCache.get(paneId)
)

// Get competition by category and period
export const useCompetition = (category: string, period: string) => useStore((state) =>
  state.competitions.find(c => c.category === category && c.period === period)
)

// Check if connected
export const useIsConnected = () => useStore((state) => state.status === 'connected')
