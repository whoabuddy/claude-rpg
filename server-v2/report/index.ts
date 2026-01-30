/**
 * Report service - generates daily summaries for /daily-brief integration
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import { getAllPersonas } from '../personas/service'
import { getAllProjects } from '../projects/service'
import { getAllCompanions } from '../companions/service'
import { getQuestsByStatus } from '../quests/service'
import type { Persona } from '../personas/types'
import type { Quest } from '../quests/types'

const log = createLogger('report')

export interface DailyReport {
  generatedAt: string
  period: {
    start: string  // ISO timestamp
    end: string    // ISO timestamp
  }
  summary: {
    activePersonas: number
    activeQuests: number
    completedQuests: number
    totalXpGained: number
  }
  personas: Array<{
    name: string
    status: string
    project: string | null
    xpGained: number
  }>
  quests: Array<{
    title: string
    status: string
    phasesComplete: number
    phasesTotal: number
  }>
  projects: Array<{
    name: string
    level: number
    xpGained: number
    commits: number
    streak: number
  }>
  highlights: string[]  // Notable events for the period
}

/**
 * Generate a report for the last N days
 */
export function generateReport(sinceDaysAgo: number = 1): DailyReport {
  const now = new Date()
  const start = new Date(now.getTime() - sinceDaysAgo * 24 * 60 * 60 * 1000)
  const startIso = start.toISOString()

  log.info('Generating report', { sinceDaysAgo, start: startIso })

  // Get active personas (seen in last hour)
  const personas = getAllPersonas().filter(p => {
    const lastSeen = new Date(p.lastSeenAt)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    return lastSeen >= oneHourAgo
  })

  // Get active and recently completed quests
  const activeQuests = getQuestsByStatus('active').concat(getQuestsByStatus('planned'))
  const allCompletedQuests = getQuestsByStatus('completed')
  const completedQuests = allCompletedQuests.filter(q =>
    q.completedAt && new Date(q.completedAt) >= start
  )

  // Get all companions (projects with stats)
  const companions = getAllCompanions()

  // Get XP events since start
  const xpEvents = getXpEventsSince(startIso)

  // Calculate XP by persona
  const xpByPersona = new Map<string, number>()
  for (const event of xpEvents) {
    if (event.persona_id) {
      const current = xpByPersona.get(event.persona_id) || 0
      xpByPersona.set(event.persona_id, current + event.xp_amount)
    }
  }

  // Calculate XP by project
  const xpByProject = new Map<string, number>()
  for (const event of xpEvents) {
    if (event.project_id) {
      const current = xpByProject.get(event.project_id) || 0
      xpByProject.set(event.project_id, current + event.xp_amount)
    }
  }

  // Build highlights
  const highlights: string[] = []
  if (completedQuests.length > 0) {
    highlights.push(`Completed ${completedQuests.length} quest${completedQuests.length > 1 ? 's' : ''}`)
  }

  const totalXp = Array.from(xpByPersona.values()).reduce((a, b) => a + b, 0)
  if (totalXp > 0) {
    highlights.push(`Gained ${totalXp} XP across ${xpByProject.size} project${xpByProject.size > 1 ? 's' : ''}`)
  }

  const activeStreaks = companions.filter(c => c.streak.current >= 7)
  if (activeStreaks.length > 0) {
    highlights.push(`${activeStreaks.length} project${activeStreaks.length > 1 ? 's' : ''} with 7+ day streak`)
  }

  return {
    generatedAt: now.toISOString(),
    period: {
      start: startIso,
      end: now.toISOString(),
    },
    summary: {
      activePersonas: personas.length,
      activeQuests: activeQuests.length,
      completedQuests: completedQuests.length,
      totalXpGained: totalXp,
    },
    personas: personas.map(p => ({
      name: p.name,
      status: p.status,
      project: null, // TODO: Could link to active project
      xpGained: xpByPersona.get(p.id) || 0,
    })),
    quests: [...activeQuests, ...completedQuests].map(q => ({
      title: q.title,
      status: q.status,
      phasesComplete: q.phases.filter(p => p.status === 'completed').length,
      phasesTotal: q.phases.length,
    })),
    projects: companions.slice(0, 10).map(c => ({
      name: c.name,
      level: c.level,
      xpGained: xpByProject.get(c.id) || 0,
      commits: c.stats.git.commits,
      streak: c.streak.current,
    })),
    highlights,
  }
}

/**
 * Get XP events since a timestamp
 */
function getXpEventsSince(since: string): Array<{
  persona_id: string | null
  project_id: string | null
  xp_amount: number
  created_at: string
}> {
  const allEvents = queries.getRecentEvents.all(10000) as Array<{
    persona_id: string | null
    project_id: string | null
    event_type: string
    xp_amount?: number
    created_at: string
  }>

  // Filter XP events since timestamp
  return allEvents
    .filter(e => e.created_at >= since)
    .map(e => ({
      persona_id: e.persona_id,
      project_id: e.project_id,
      xp_amount: e.xp_amount || 0,
      created_at: e.created_at,
    }))
}

/**
 * Convert report to markdown format for LLM consumption
 */
export function reportToMarkdown(report: DailyReport): string {
  const lines: string[] = []

  lines.push('# Claude RPG Daily Report')
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`)
  lines.push('')

  lines.push('## Summary')
  lines.push(`- ${report.summary.activePersonas} active worker${report.summary.activePersonas !== 1 ? 's' : ''}`)
  lines.push(`- ${report.summary.activeQuests} quest${report.summary.activeQuests !== 1 ? 's' : ''} in progress`)
  lines.push(`- ${report.summary.completedQuests} quest${report.summary.completedQuests !== 1 ? 's' : ''} completed`)
  lines.push(`- ${report.summary.totalXpGained} XP gained`)
  lines.push('')

  if (report.highlights.length > 0) {
    lines.push('## Highlights')
    for (const h of report.highlights) {
      lines.push(`- ${h}`)
    }
    lines.push('')
  }

  if (report.quests.length > 0) {
    lines.push('## Quests')
    for (const q of report.quests) {
      const progress = `${q.phasesComplete}/${q.phasesTotal}`
      lines.push(`- **${q.title}** (${q.status}) - ${progress} phases`)
    }
    lines.push('')
  }

  if (report.projects.length > 0) {
    lines.push('## Projects')
    for (const p of report.projects) {
      const streak = p.streak > 0 ? ` (${p.streak}d streak)` : ''
      lines.push(`- **${p.name}** Lv${p.level} - +${p.xpGained} XP${streak}`)
    }
  }

  return lines.join('\n')
}
