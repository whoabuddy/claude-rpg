/**
 * Project-related types for team stats and narrative generation
 */

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

export interface NarrativeSummary {
  title: string
  tagline: string
  teamSection: string[]
  activitySection: string[]
  milestonesSection: string[]
  markdown: string
  teamStats?: TeamStats  // Included when format=json
}
