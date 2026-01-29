/**
 * XP types
 */

export type XpEventCategory =
  | 'tool_use'
  | 'git'
  | 'quest'
  | 'achievement'
  | 'bonus'

export interface XpEvent {
  id: number
  personaId: string | null
  projectId: string | null
  eventType: string
  xpAmount: number
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface XpGain {
  personaId: string | null
  projectId: string | null
  eventType: string
  amount: number
  metadata?: Record<string, unknown>
}

export interface LevelInfo {
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  progressPercent: number
  title: string
}

export interface XpCategorySummary {
  category: string
  total: number
  count: number
}

export interface XpTimelineEntry {
  date: string
  xp: number
}
