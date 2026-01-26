import { createContext, useContext } from 'react'

export interface PaneActionsContextValue {
  onSendPrompt: (paneId: string, text: string) => Promise<{ ok: boolean; error?: string }>
  onSendSignal: (paneId: string, signal: string) => void
  onDismissWaiting: (paneId: string) => void
  onExpandPane: (paneId: string) => void
  onRefreshPane: (paneId: string) => void
  onClosePane: (paneId: string) => void
  rpgEnabled: boolean
}

const PaneActionsContext = createContext<PaneActionsContextValue | null>(null)

export function usePaneActions(): PaneActionsContextValue {
  const ctx = useContext(PaneActionsContext)
  if (!ctx) throw new Error('usePaneActions must be used within PaneActionsProvider')
  return ctx
}

export const PaneActionsProvider = PaneActionsContext.Provider
