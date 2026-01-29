import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
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

// Toast types for notification system
export interface Toast {
  id: string
  type: 'error' | 'xp' | 'quest_xp' | 'achievement' | 'info'
  title: string
  body?: string
  timestamp: number
}

export interface ToastsState {
  toasts: Toast[]
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
  ToastsState,
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

  // Actions - Toasts
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void
  removeToast: (id: string) => void
  clearExpiredToasts: () => void

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

      // Initial state - Toasts
      toasts: [],

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

      setWindows: (windows) => set({ windows }),

      updatePane: (pane) => set((state) => {
        const windows = state.windows.map(window => ({
          ...window,
          panes: window.panes.map(p =>
            p.id === pane.id ? pane : p
          )
        }))
        return { windows }
      }),

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
      }),

      setTerminalContent: (paneId, content) => set((state) => {
        const terminalCache = new Map(state.terminalCache)
        terminalCache.set(paneId, content)
        return { terminalCache }
      }),

      // ═════════════════════════════════════════════════════════════════════
      // COMPANION ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setCompanions: (companions) => set({ companions }),

      updateCompanion: (companion) => set((state) => {
        const exists = state.companions.some(c => c.id === companion.id)
        const companions = exists
          ? state.companions.map(c => c.id === companion.id ? companion : c)
          : [...state.companions, companion]
        return { companions }
      }),

      // ═════════════════════════════════════════════════════════════════════
      // QUEST ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setQuests: (quests) => set({ quests }),

      updateQuest: (quest) => set((state) => {
        const exists = state.quests.some(q => q.id === quest.id)
        const quests = exists
          ? state.quests.map(q => q.id === quest.id ? quest : q)
          : [...state.quests, quest]
        return { quests }
      }),

      // ═════════════════════════════════════════════════════════════════════
      // COMPETITION ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setCompetitions: (competitions) => set({ competitions }),

      // ═════════════════════════════════════════════════════════════════════
      // WORKER ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setWorkers: (workers) => set({ workers }),

      // ═════════════════════════════════════════════════════════════════════
      // EVENT ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      addEvent: (event) => set((state) => {
        const recentEvents = [event, ...state.recentEvents].slice(0, MAX_EVENTS)
        return { recentEvents }
      }),

      addXPGain: (xpGain) => set((state) => {
        const recentXPGains = [xpGain, ...state.recentXPGains].slice(0, MAX_XP_GAINS)
        return { recentXPGains }
      }),

      setEventHistory: (events) => set({
        recentEvents: events.slice(0, MAX_EVENTS)
      }),

      // ═════════════════════════════════════════════════════════════════════
      // TOAST ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      addToast: (toast) => set((state) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const newToast = { ...toast, id, timestamp: Date.now() }
        return { toasts: [...state.toasts, newToast].slice(-5) } // Max 5 toasts
      }),

      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),

      clearExpiredToasts: () => set((state) => {
        const now = Date.now()
        const TOAST_DURATION = 4000
        return { toasts: state.toasts.filter(t => now - t.timestamp < TOAST_DURATION) }
      }),

      // ═════════════════════════════════════════════════════════════════════
      // CONNECTION ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setConnectionStatus: (status) => set((state) => ({
        status,
        lastConnected: status === 'connected' ? Date.now() : state.lastConnected,
        reconnectAttempt: status === 'connected' ? 0 : state.reconnectAttempt
      })),

      setReconnectAttempt: (attempt) => set({ reconnectAttempt: attempt }),

      // ═════════════════════════════════════════════════════════════════════
      // UI ACTIONS
      // ═════════════════════════════════════════════════════════════════════

      setSelectedPane: (paneId) => set({ selectedPaneId: paneId }),

      setFullScreenPane: (paneId) => set({ fullScreenPaneId: paneId }),

      setActivePage: (page) => set({ activePage: page }),

      setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),

    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  }))
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
