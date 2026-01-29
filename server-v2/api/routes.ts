/**
 * Route definitions and matching
 */

import type { Route } from './types'

/**
 * All API routes
 */
export const ROUTES: Route[] = [
  // Health
  { method: 'GET', pattern: '/health', handler: 'health' },

  // Events (Claude hooks)
  { method: 'POST', pattern: '/event', handler: 'handleEvent' },

  // Windows
  { method: 'GET', pattern: '/api/windows', handler: 'listWindows' },
  { method: 'POST', pattern: '/api/windows/create', handler: 'createWindow' },
  { method: 'POST', pattern: '/api/windows/:id/rename', handler: 'renameWindow' },
  { method: 'POST', pattern: '/api/windows/:id/close', handler: 'closeWindow' },
  { method: 'POST', pattern: '/api/windows/:id/new-pane', handler: 'newPane' },
  { method: 'POST', pattern: '/api/windows/:id/new-claude', handler: 'newClaude' },

  // Panes
  { method: 'POST', pattern: '/api/panes/:id/prompt', handler: 'sendPrompt' },
  { method: 'POST', pattern: '/api/panes/:id/signal', handler: 'sendSignal' },
  { method: 'POST', pattern: '/api/panes/:id/dismiss', handler: 'dismissPane' },
  { method: 'POST', pattern: '/api/panes/:id/refresh', handler: 'refreshPane' },
  { method: 'POST', pattern: '/api/panes/:id/close', handler: 'closePane' },

  // Personas
  { method: 'GET', pattern: '/api/personas', handler: 'listPersonas' },
  { method: 'GET', pattern: '/api/personas/:id', handler: 'getPersona' },

  // Projects
  { method: 'GET', pattern: '/api/projects', handler: 'listProjects' },
  { method: 'GET', pattern: '/api/projects/:id', handler: 'getProject' },

  // Quests
  { method: 'GET', pattern: '/api/quests', handler: 'listQuests' },
  { method: 'GET', pattern: '/api/quests/:id', handler: 'getQuest' },
  { method: 'PATCH', pattern: '/api/quests/:id', handler: 'updateQuest' },

  // XP
  { method: 'GET', pattern: '/api/xp/summary', handler: 'xpSummary' },
  { method: 'GET', pattern: '/api/xp/timeline', handler: 'xpTimeline' },
]

export interface MatchedRoute {
  route: Route
  params: Record<string, string>
}

/**
 * Match a request to a route
 */
export function matchRoute(method: string, pathname: string): MatchedRoute | null {
  for (const route of ROUTES) {
    if (route.method !== method) continue

    const params = matchPattern(route.pattern, pathname)
    if (params !== null) {
      return { route, params }
    }
  }

  return null
}

/**
 * Match a pattern against a pathname
 * Returns params object if matched, null if no match
 */
function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/')
  const pathParts = pathname.split('/')

  if (patternParts.length !== pathParts.length) {
    return null
  }

  const params: Record<string, string> = {}

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const pathPart = pathParts[i]

    if (patternPart.startsWith(':')) {
      // Param capture
      const paramName = patternPart.slice(1)
      params[paramName] = pathPart
    } else if (patternPart !== pathPart) {
      // Literal mismatch
      return null
    }
  }

  return params
}
