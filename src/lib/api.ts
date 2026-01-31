/**
 * API client for Claude RPG server.
 * Module-level functions for stable references in components.
 */

const API_URL = '' // Same origin, proxied by Vite in dev

/**
 * Fetch initial data and populate Zustand store.
 * Shared pattern used by hooks on mount before WebSocket connects.
 */
export function fetchInitialData<T>(
  endpoint: string,
  setter: (data: T) => void,
): void {
  fetch(`${API_URL}/api/${endpoint}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        setter(data.data)
      }
    })
    .catch(e => {
      console.error(`[claude-rpg] Error fetching ${endpoint}:`, e)
    })
}

/**
 * Generic POST helper with retry logic and better error messages
 */
export async function apiPost<T extends { ok: boolean }>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  // Check if device is offline before attempting request
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, error: 'Device offline' } as unknown as T
  }

  const maxAttempts = 3
  const retryDelay = 500 // ms
  const timeout = 10000 // 10 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(), timeout)

      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // HTTP errors (4xx, 5xx) should not be retried
      if (!res.ok) {
        let errorMessage = ''
        try {
          const contentType = res.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            const errorBody = await res.json()
            if (errorBody && typeof errorBody === 'object') {
              if (typeof errorBody.error === 'string' && errorBody.error.trim()) {
                errorMessage = errorBody.error
              } else if (typeof errorBody.message === 'string' && errorBody.message.trim()) {
                errorMessage = errorBody.message
              }
            }
          }
        } catch {
          // Ignore parsing errors
        }
        if (!errorMessage) {
          const prefix = res.status >= 500 ? 'Server error' : 'Request failed'
          errorMessage = `${prefix} (${res.status})`
        }
        return { ok: false, error: errorMessage } as unknown as T
      }

      return await res.json()
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)

      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        return { ok: false, error: 'Request timed out' } as unknown as T
      }

      // Network errors - retry if attempts remain
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }

      return { ok: false, error: 'Connection failed - check your network' } as unknown as T
    }
  }

  return { ok: false, error: 'Connection failed - check your network' } as unknown as T
}

function panePath(paneId: string, action: string) {
  return `/api/panes/${encodeURIComponent(paneId)}/${action}`
}

function windowPath(windowId: string, action: string) {
  return `/api/windows/${encodeURIComponent(windowId)}/${action}`
}

// ═══════════════════════════════════════════════════════════════════════════
// PANE ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function sendPromptToPane(
  paneId: string,
  prompt: string,
  options?: { isPermissionResponse?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const data = await apiPost<{ ok: boolean; error?: string }>(
    panePath(paneId, 'prompt'),
    { prompt, ...(options?.isPermissionResponse && { isPermissionResponse: true }) },
  )
  if (!data.ok) console.error('[sendPromptToPane] Server returned error:', data.error)
  return data
}

export async function sendSignalToPane(paneId: string, signal: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'signal'), { signal })).ok
}

export async function dismissWaiting(paneId: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'dismiss'))).ok
}

export async function refreshPane(paneId: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'refresh'))).ok
}

export async function closePane(paneId: string): Promise<boolean> {
  return (await apiPost(panePath(paneId, 'close'))).ok
}

export async function sendArrowKey(paneId: string, direction: 'up' | 'down'): Promise<boolean> {
  const key = direction === 'up' ? 'Up' : 'Down'
  return (await apiPost(panePath(paneId, 'prompt'), { prompt: key })).ok
}

// ═══════════════════════════════════════════════════════════════════════════
// WINDOW ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function createPaneInWindow(windowId: string) {
  return apiPost<{ ok: boolean; paneCount?: number; error?: string }>(windowPath(windowId, 'new-pane'))
}

export function createClaudeInWindow(windowId: string) {
  return apiPost<{ ok: boolean; paneCount?: number; error?: string }>(windowPath(windowId, 'new-claude'))
}

export function createWindow(sessionName: string, windowName: string) {
  return apiPost<{ ok: boolean; sessionName?: string; windowName?: string; error?: string }>(
    '/api/windows/create', { sessionName, windowName },
  )
}

export function renameWindow(windowId: string, windowName: string) {
  return apiPost<{ ok: boolean; error?: string }>(windowPath(windowId, 'rename'), { windowName })
}

export function closeWindow(windowId: string) {
  return apiPost<{ ok: boolean; error?: string }>(windowPath(windowId, 'close'))
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function sendPromptToCompanion(companionId: string, prompt: string) {
  return apiPost<{ ok: boolean; paneId?: string; companionName?: string; error?: string }>(
    `/api/companions/${encodeURIComponent(companionId)}/prompt`,
    { prompt },
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get project narrative (team stats summary)
 * @param projectId - Project/companion ID
 * @param format - 'json' for full structure, 'markdown' for markdown text
 */
export async function getProjectNarrative(
  projectId: string,
  format: 'json' | 'markdown' = 'json'
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const url = `${API_URL}/api/projects/${encodeURIComponent(projectId)}/narrative?format=${format}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` }
    }
    const json = await res.json()
    // API returns { success: true, data: ... } format
    if (json.success && json.data) {
      return { ok: true, data: json.data }
    } else if (json.error) {
      return { ok: false, error: json.error.message || 'API error' }
    }
    return { ok: false, error: 'Invalid response format' }
  } catch (error) {
    console.error('[getProjectNarrative] Error:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOLTBOOK ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch moltbook data and call setter with result.
 * Returns a promise that resolves when the fetch completes.
 */
export async function fetchMoltbookData<T>(
  endpoint: string,
  setter: (data: T) => void,
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/${endpoint}`)
    const json = await res.json()
    if (json.success && json.data) {
      setter(json.data)
    }
  } catch (e) {
    console.error(`[claude-rpg] Error fetching ${endpoint}:`, e)
  }
}
