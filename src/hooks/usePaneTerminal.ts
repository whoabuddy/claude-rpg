import { useStore } from '../store'

/**
 * Hook to get terminal content for a pane from the Zustand store.
 * Terminal content is populated by WebSocket messages and cached in the store.
 */
export function usePaneTerminal(paneId: string | null): string | undefined {
  return useStore((state) => paneId ? state.terminalCache.get(paneId) : undefined)
}
