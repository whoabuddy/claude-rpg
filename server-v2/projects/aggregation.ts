/**
 * Project team stats aggregation
 * Computes team contributions and activity from XP events
 */

import { getDatabase } from '../db'
import type { XpEventRow } from '../db/queries'

export interface PersonaContribution {
  personaId: string
  personaName: string
  xp: number
  percentage: number
  commits: number
  topTools: string[]
}

export interface TeamStats {
  totalXp: number
  uniquePersonas: number
  personaContributions: PersonaContribution[]
  topTools: Record<string, number>
  gitStats: {
    totalCommits: number
    totalPushes: number
    totalPrs: number
  }
  questStats: {
    created: number
    completed: number
    phasesCompleted: number
  }
  activityByDay: Record<string, number>
  firstActivity: string
  lastActivity: string
}

/**
 * Get all XP events for a project
 */
function getXpEventsByProject(projectId: string): XpEventRow[] {
  const db = getDatabase()
  const stmt = db.prepare<XpEventRow, [string]>(
    'SELECT * FROM xp_events WHERE project_id = ? ORDER BY created_at ASC'
  )
  return stmt.all(projectId)
}

/**
 * Get persona name by ID
 */
function getPersonaName(personaId: string): string {
  const db = getDatabase()
  const stmt = db.prepare<{ name: string }, [string]>(
    'SELECT name FROM personas WHERE id = ?'
  )
  const result = stmt.get(personaId)
  return result?.name ?? 'Unknown'
}

/**
 * Extract tool name from event_type
 * Examples:
 * - "tool:Edit" -> "Edit"
 * - "tool:Bash" -> "Bash"
 * - "commit" -> null
 */
function extractToolName(eventType: string): string | null {
  if (eventType.startsWith('tool:')) {
    return eventType.substring(5)
  }
  return null
}

/**
 * Get day of week from ISO timestamp
 * Returns 0-6 (Sunday-Saturday)
 */
function getDayOfWeek(timestamp: string): number {
  return new Date(timestamp).getDay()
}

/**
 * Compute team stats for a project
 */
export function getProjectTeamStats(projectId: string): TeamStats {
  const events = getXpEventsByProject(projectId)

  if (events.length === 0) {
    return {
      totalXp: 0,
      uniquePersonas: 0,
      personaContributions: [],
      topTools: {},
      gitStats: {
        totalCommits: 0,
        totalPushes: 0,
        totalPrs: 0,
      },
      questStats: {
        created: 0,
        completed: 0,
        phasesCompleted: 0,
      },
      activityByDay: {},
      firstActivity: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }
  }

  // Aggregate by persona
  const personaMap = new Map<string, {
    xp: number
    commits: number
    tools: Map<string, number>
  }>()

  const toolsGlobal = new Map<string, number>()
  const activityByDay = new Map<string, number>()

  let totalCommits = 0
  let totalPushes = 0
  let totalPrs = 0
  let questsCreated = 0
  let questsCompleted = 0
  let phasesCompleted = 0

  // Process all events
  for (const event of events) {
    if (!event.persona_id) continue

    // Initialize persona entry
    if (!personaMap.has(event.persona_id)) {
      personaMap.set(event.persona_id, {
        xp: 0,
        commits: 0,
        tools: new Map(),
      })
    }

    const persona = personaMap.get(event.persona_id)!

    // Add XP
    persona.xp += event.xp_amount

    // Track tool usage
    const tool = extractToolName(event.event_type)
    if (tool) {
      persona.tools.set(tool, (persona.tools.get(tool) ?? 0) + 1)
      toolsGlobal.set(tool, (toolsGlobal.get(tool) ?? 0) + 1)
    }

    // Track git events
    if (event.event_type === 'commit') {
      persona.commits++
      totalCommits++
    } else if (event.event_type === 'push') {
      totalPushes++
    } else if (event.event_type === 'pr_created') {
      totalPrs++
    }

    // Track quest events
    if (event.event_type === 'quest_created') {
      questsCreated++
    } else if (event.event_type === 'quest_completed') {
      questsCompleted++
    } else if (event.event_type === 'phase_completed') {
      phasesCompleted++
    }

    // Track activity by day of week
    const day = getDayOfWeek(event.created_at)
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
    activityByDay.set(dayName, (activityByDay.get(dayName) ?? 0) + 1)
  }

  // Calculate total XP
  const totalXp = Array.from(personaMap.values()).reduce((sum, p) => sum + p.xp, 0)

  // Build persona contributions with percentages
  const personaContributions: PersonaContribution[] = Array.from(personaMap.entries())
    .map(([personaId, data]) => {
      // Get top 3 tools for this persona
      const topTools = Array.from(data.tools.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tool]) => tool)

      return {
        personaId,
        personaName: getPersonaName(personaId),
        xp: data.xp,
        percentage: totalXp > 0 ? Math.round((data.xp / totalXp) * 100) : 0,
        commits: data.commits,
        topTools,
      }
    })
    .sort((a, b) => b.xp - a.xp) // Sort by XP descending

  return {
    totalXp,
    uniquePersonas: personaMap.size,
    personaContributions,
    topTools: Object.fromEntries(toolsGlobal),
    gitStats: {
      totalCommits,
      totalPushes,
      totalPrs,
    },
    questStats: {
      created: questsCreated,
      completed: questsCompleted,
      phasesCompleted,
    },
    activityByDay: Object.fromEntries(activityByDay),
    firstActivity: events[0].created_at,
    lastActivity: events[events.length - 1].created_at,
  }
}
