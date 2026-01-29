/**
 * Narrative generator for projects
 * Transforms project stats into story-like summaries
 */

import type { TeamStats } from './aggregation'

export interface NarrativeSummary {
  title: string           // "claude-rpg: A Story of Code"
  tagline: string         // "Level 5 backend project"
  teamSection: string[]   // Paragraphs about team
  activitySection: string[]
  milestonesSection: string[]
  markdown: string        // Full formatted markdown
}

/**
 * Generate a narrative summary for a project
 */
export function generateNarrative(
  projectId: string,
  projectName: string,
  level: number,
  projectClass: string,
  teamStats: TeamStats
): NarrativeSummary {
  const title = `${projectName}: A Story of Code`
  const tagline = `Level ${level} ${projectClass === 'unknown' ? '' : projectClass + ' '}project`

  const teamSection = generateTeamSection(teamStats)
  const activitySection = generateActivitySection(teamStats)
  const milestonesSection = generateMilestonesSection(level, teamStats)

  const markdown = formatMarkdown(title, tagline, teamSection, activitySection, milestonesSection)

  return {
    title,
    tagline,
    teamSection,
    activitySection,
    milestonesSection,
    markdown,
  }
}

/**
 * Generate team section paragraphs
 */
function generateTeamSection(stats: TeamStats): string[] {
  const paragraphs: string[] = []

  if (stats.uniquePersonas === 0) {
    paragraphs.push('This project is just getting started.')
    return paragraphs
  }

  // Opening paragraph
  if (stats.uniquePersonas === 1) {
    const contributor = stats.personaContributions[0]
    paragraphs.push(
      `${contributor.personaName} has been the sole contributor to this project, bringing dedication and skill to every commit.`
    )
  } else {
    paragraphs.push(
      `This project has been shaped by ${stats.uniquePersonas} contributors, each bringing their unique perspective and expertise.`
    )
  }

  // Top contributor highlight
  if (stats.personaContributions.length > 0) {
    const top = stats.personaContributions[0]
    const topToolsText = top.topTools.length > 0
      ? ` Their toolkit of choice: ${formatList(top.topTools)}.`
      : ''

    if (stats.uniquePersonas === 1) {
      paragraphs.push(
        `With ${formatNumber(top.xp)} XP earned and ${formatNumber(top.commits)} commits created, their impact is measurable.${topToolsText}`
      )
    } else {
      paragraphs.push(
        `Leading the charge is ${top.personaName}, responsible for ${top.percentage}% of the project's growth. ` +
        `With ${formatNumber(top.xp)} XP earned and ${formatNumber(top.commits)} commits created, their impact is undeniable.${topToolsText}`
      )
    }
  }

  // Supporting contributors
  if (stats.personaContributions.length > 1) {
    const others = stats.personaContributions.slice(1, 4) // Top 2-4 contributors
    if (others.length > 0) {
      const names = others.map((c) => `${c.personaName} (${c.percentage}%)`)
      paragraphs.push(
        `Supporting the effort: ${formatList(names, 'and')}. Every contribution matters.`
      )
    }
  }

  return paragraphs
}

/**
 * Generate activity section paragraphs
 */
function generateActivitySection(stats: TeamStats): string[] {
  const paragraphs: string[] = []

  if (stats.totalXp === 0) {
    paragraphs.push('Activity will appear here as work begins.')
    return paragraphs
  }

  // Total work summary
  paragraphs.push(
    `This project has generated ${formatNumber(stats.totalXp)} XP across ${formatNumber(stats.gitStats.totalCommits)} commits. ` +
    `Each line of code represents a decision, each commit a step forward.`
  )

  // Peak activity day
  const peakDay = findPeakDay(stats.activityByDay)
  if (peakDay) {
    paragraphs.push(`Most active on ${peakDay}s, when the code flows freely.`)
  }

  // Timeline
  if (stats.firstActivity && stats.lastActivity) {
    const duration = formatDuration(stats.firstActivity, stats.lastActivity)
    paragraphs.push(
      `From ${formatDate(stats.firstActivity)} to ${formatDate(stats.lastActivity)} – ${duration} of continuous evolution.`
    )
  }

  // Git activity
  if (stats.gitStats.totalPushes > 0 || stats.gitStats.totalPrs > 0) {
    const gitParts: string[] = []
    if (stats.gitStats.totalPushes > 0) {
      gitParts.push(`${formatNumber(stats.gitStats.totalPushes)} pushes`)
    }
    if (stats.gitStats.totalPrs > 0) {
      gitParts.push(`${formatNumber(stats.gitStats.totalPrs)} pull requests`)
    }
    paragraphs.push(`The rhythm of collaboration: ${gitParts.join(', ')}.`)
  }

  return paragraphs
}

/**
 * Generate milestones section paragraphs
 */
function generateMilestonesSection(level: number, stats: TeamStats): string[] {
  const paragraphs: string[] = []

  // Level milestone
  if (level > 1) {
    paragraphs.push(`**Level ${level} Achievement**: This project has grown through ${level} levels of mastery.`)
  }

  // Quest completions
  if (stats.questStats.completed > 0) {
    paragraphs.push(
      `**Quest Mastery**: ${formatNumber(stats.questStats.completed)} quests completed` +
      (stats.questStats.phasesCompleted > 0 ? `, ${formatNumber(stats.questStats.phasesCompleted)} phases executed` : '') +
      '.'
    )
  }

  // Tool mastery
  const topTools = Object.entries(stats.topTools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tool]) => tool)

  if (topTools.length > 0) {
    paragraphs.push(`**Tool Mastery**: ${formatList(topTools)} wielded with precision.`)
  }

  if (paragraphs.length === 0) {
    paragraphs.push('Milestones will be recorded here as the project grows.')
  }

  return paragraphs
}

/**
 * Format sections into markdown document
 */
function formatMarkdown(
  title: string,
  tagline: string,
  teamSection: string[],
  activitySection: string[],
  milestonesSection: string[]
): string {
  const parts: string[] = []

  parts.push(`# ${title}`)
  parts.push('')
  parts.push(`*${tagline}*`)
  parts.push('')
  parts.push('---')
  parts.push('')

  parts.push('## The Team')
  parts.push('')
  for (const para of teamSection) {
    parts.push(para)
    parts.push('')
  }

  parts.push('## The Work')
  parts.push('')
  for (const para of activitySection) {
    parts.push(para)
    parts.push('')
  }

  parts.push('## Milestones')
  parts.push('')
  for (const para of milestonesSection) {
    parts.push(para)
    parts.push('')
  }

  return parts.join('\n')
}

/**
 * Find the day of week with most activity
 */
function findPeakDay(activityByDay: Record<string, number>): string | null {
  const entries = Object.entries(activityByDay)
  if (entries.length === 0) return null

  const sorted = entries.sort((a, b) => b[1] - a[1])
  return sorted[0][0]
}

/**
 * Format a list with proper commas and conjunction
 */
function formatList(items: string[], conjunction: string = 'and'): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`

  const last = items[items.length - 1]
  const rest = items.slice(0, -1)
  return `${rest.join(', ')}, ${conjunction} ${last}`
}

/**
 * Format a number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format an ISO date to readable format
 */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Calculate duration between two dates
 */
function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (days === 0) return 'less than a day'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? '1 week' : `${weeks} weeks`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month' : `${months} months`
  }

  const years = Math.floor(days / 365)
  return years === 1 ? '1 year' : `${years} years`
}
