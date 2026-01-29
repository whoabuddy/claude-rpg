/**
 * XP ledger for tracking all XP events
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import { getXpCategory } from './calculator'
import type { XpEvent, XpGain, XpCategorySummary, XpTimelineEntry } from './types'

const log = createLogger('xp-ledger')

/**
 * Record an XP event to the ledger
 */
export function recordXpEvent(gain: XpGain): void {
  const now = new Date().toISOString()
  const metadata = gain.metadata ? JSON.stringify(gain.metadata) : null

  queries.insertXpEvent.run(
    gain.personaId,
    gain.projectId,
    gain.eventType,
    gain.amount,
    metadata,
    now
  )

  log.debug('Recorded XP event', {
    personaId: gain.personaId,
    projectId: gain.projectId,
    eventType: gain.eventType,
    amount: gain.amount,
  })
}

/**
 * Get XP breakdown by category for an entity
 */
export function getXpByCategory(
  entityType: 'persona' | 'project',
  entityId: string,
  since?: Date
): XpCategorySummary[] {
  const query = entityType === 'persona'
    ? queries.getXpEventsByPersona
    : queries.getXpEventsByProject

  const events = query.all(entityId) as Array<Record<string, unknown>>

  // Filter by date if specified
  const filtered = since
    ? events.filter(e => new Date(e.created_at as string) >= since)
    : events

  // Group by category
  const categories = new Map<string, { total: number; count: number }>()

  for (const event of filtered) {
    const eventType = event.event_type as string
    const category = getXpCategory(eventType)
    const amount = event.xp_amount as number

    const existing = categories.get(category) || { total: 0, count: 0 }
    existing.total += amount
    existing.count += 1
    categories.set(category, existing)
  }

  return Array.from(categories.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    count: data.count,
  }))
}

/**
 * Get XP timeline for charts
 */
export function getXpTimeline(
  entityType: 'persona' | 'project',
  entityId: string,
  days: number
): XpTimelineEntry[] {
  const query = entityType === 'persona'
    ? queries.getXpEventsByPersona
    : queries.getXpEventsByProject

  const events = query.all(entityId) as Array<Record<string, unknown>>

  // Calculate start date
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  // Filter and group by day
  const dailyXp = new Map<string, number>()

  // Initialize all days with 0
  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    dailyXp.set(date.toISOString().split('T')[0], 0)
  }

  // Sum XP per day
  for (const event of events) {
    const eventDate = new Date(event.created_at as string)
    if (eventDate >= startDate) {
      const dateKey = eventDate.toISOString().split('T')[0]
      const existing = dailyXp.get(dateKey) || 0
      dailyXp.set(dateKey, existing + (event.xp_amount as number))
    }
  }

  return Array.from(dailyXp.entries())
    .map(([date, xp]) => ({ date, xp }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Get recent XP events
 */
export function getRecentXpEvents(
  entityType: 'persona' | 'project',
  entityId: string,
  limit: number = 50
): XpEvent[] {
  const query = entityType === 'persona'
    ? queries.getXpEventsByPersona
    : queries.getXpEventsByProject

  const events = query.all(entityId) as Array<Record<string, unknown>>

  return events.slice(0, limit).map(mapDbToXpEvent)
}

/**
 * Map database row to XpEvent type
 */
function mapDbToXpEvent(row: Record<string, unknown>): XpEvent {
  return {
    id: row.id as number,
    personaId: row.persona_id as string | null,
    projectId: row.project_id as string | null,
    eventType: row.event_type as string,
    xpAmount: row.xp_amount as number,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    createdAt: row.created_at as string,
  }
}
