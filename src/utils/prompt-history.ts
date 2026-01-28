// Module-level Map storing the last successfully sent prompt per pane.
// Survives component remounts since it lives outside React state.
// Persisted to localStorage for cross-session recovery.

const STORAGE_KEY = 'claude-rpg-last-prompts'

// Load from localStorage on module initialization
function loadFromStorage(): Map<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return new Map(Object.entries(parsed))
    }
  } catch {
    // Silently fail if localStorage unavailable or corrupted
  }
  return new Map()
}

// Save to localStorage whenever the Map changes
function saveToStorage(map: Map<string, string>) {
  try {
    const obj = Object.fromEntries(map)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // Silently fail if localStorage unavailable
  }
}

export const lastPromptByPane = loadFromStorage()

// Wrap the original Map.set to persist on changes
const originalSet = lastPromptByPane.set.bind(lastPromptByPane)
lastPromptByPane.set = function(paneId: string, prompt: string) {
  originalSet(paneId, prompt)
  saveToStorage(lastPromptByPane)
  return lastPromptByPane
}
