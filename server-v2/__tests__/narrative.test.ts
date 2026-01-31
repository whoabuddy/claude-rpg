/**
 * Tests for narrative generation system
 *
 * Tests the transformation of project stats into story-like summaries.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { generateNarrative, type NarrativeSummary } from '../projects/narrative'
import type { TeamStats, PersonaContribution } from '../projects/aggregation'

/**
 * Create empty TeamStats for testing
 */
function createEmptyTeamStats(): TeamStats {
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

/**
 * Create a persona contribution for testing
 */
function createContribution(
  name: string,
  xp: number,
  percentage: number,
  commits: number = 0,
  topTools: string[] = []
): PersonaContribution {
  return {
    personaId: `persona-${name.toLowerCase()}`,
    personaName: name,
    xp,
    percentage,
    commits,
    topTools,
  }
}

describe('Narrative Generation', () => {
  describe('generateNarrative', () => {
    test('generates narrative for empty project', () => {
      const stats = createEmptyTeamStats()
      const narrative = generateNarrative(
        'project-1',
        'my-project',
        1,
        'unknown',
        stats
      )

      expect(narrative.title).toBe('my-project: A Story of Code')
      expect(narrative.tagline).toBe('Level 1 project')
      expect(narrative.teamSection).toContain('This project is just getting started.')
      expect(narrative.activitySection).toContain('Activity will appear here as work begins.')
      expect(narrative.milestonesSection).toContain('Milestones will be recorded here as the project grows.')
      expect(narrative.markdown).toContain('# my-project: A Story of Code')
    })

    test('includes project class in tagline when known', () => {
      const stats = createEmptyTeamStats()
      const narrative = generateNarrative(
        'project-1',
        'my-api',
        3,
        'backend',
        stats
      )

      expect(narrative.tagline).toBe('Level 3 backend project')
    })

    test('generates narrative for single contributor', () => {
      const stats = createEmptyTeamStats()
      stats.totalXp = 1500
      stats.uniquePersonas = 1
      stats.personaContributions = [
        createContribution('Cipher', 1500, 100, 25, ['Edit', 'Bash', 'Read']),
      ]
      stats.gitStats.totalCommits = 25

      const narrative = generateNarrative(
        'project-1',
        'solo-project',
        5,
        'frontend',
        stats
      )

      // Team section should highlight sole contributor
      expect(narrative.teamSection[0]).toContain('Cipher has been the sole contributor')
      expect(narrative.teamSection[0]).toContain('dedication and skill')

      // Should mention XP and commits
      expect(narrative.teamSection.some(p => p.includes('1,500 XP'))).toBe(true)
      expect(narrative.teamSection.some(p => p.includes('25 commits'))).toBe(true)

      // Should mention tools
      expect(narrative.teamSection.some(p => p.includes('Edit'))).toBe(true)
    })

    test('generates narrative for multiple contributors', () => {
      const stats = createEmptyTeamStats()
      stats.totalXp = 5000
      stats.uniquePersonas = 3
      stats.personaContributions = [
        createContribution('Cipher', 3000, 60, 30, ['Edit', 'Bash']),
        createContribution('Nova', 1500, 30, 15, ['Read', 'Grep']),
        createContribution('Echo', 500, 10, 5, ['Write']),
      ]
      stats.gitStats.totalCommits = 50

      const narrative = generateNarrative(
        'project-1',
        'team-project',
        7,
        'fullstack',
        stats
      )

      // Should mention number of contributors
      expect(narrative.teamSection[0]).toContain('3 contributors')

      // Should highlight lead contributor
      expect(narrative.teamSection.some(p => p.includes('Leading the charge is Cipher'))).toBe(true)
      expect(narrative.teamSection.some(p => p.includes('60%'))).toBe(true)

      // Should mention supporting contributors
      expect(narrative.teamSection.some(p => p.includes('Nova'))).toBe(true)
      expect(narrative.teamSection.some(p => p.includes('Echo'))).toBe(true)
    })

    test('generates activity section with git stats', () => {
      const stats = createEmptyTeamStats()
      stats.totalXp = 2000
      stats.uniquePersonas = 1
      stats.personaContributions = [
        createContribution('Cipher', 2000, 100, 20),
      ]
      stats.gitStats.totalCommits = 20
      stats.gitStats.totalPushes = 15
      stats.gitStats.totalPrs = 5
      stats.activityByDay = {
        'Monday': 10,
        'Tuesday': 5,
        'Wednesday': 3,
      }
      stats.firstActivity = '2024-01-15T10:00:00Z'
      stats.lastActivity = '2024-03-15T15:00:00Z'

      const narrative = generateNarrative(
        'project-1',
        'active-project',
        4,
        'backend',
        stats
      )

      // Should mention total XP and commits
      expect(narrative.activitySection.some(p => p.includes('2,000 XP'))).toBe(true)
      expect(narrative.activitySection.some(p => p.includes('20 commits'))).toBe(true)

      // Should mention peak day
      expect(narrative.activitySection.some(p => p.includes('Monday'))).toBe(true)

      // Should mention pushes and PRs
      expect(narrative.activitySection.some(p => p.includes('15 pushes'))).toBe(true)
      expect(narrative.activitySection.some(p => p.includes('5 pull requests'))).toBe(true)

      // Should mention duration
      expect(narrative.activitySection.some(p => p.includes('2 months'))).toBe(true)
    })

    test('generates milestones section with level and quests', () => {
      const stats = createEmptyTeamStats()
      stats.totalXp = 10000
      stats.uniquePersonas = 2
      stats.personaContributions = [
        createContribution('Cipher', 7000, 70, 35),
        createContribution('Nova', 3000, 30, 15),
      ]
      stats.questStats.completed = 5
      stats.questStats.phasesCompleted = 20
      stats.topTools = {
        'Edit': 150,
        'Bash': 80,
        'Read': 60,
        'Grep': 40,
        'Write': 30,
      }

      const narrative = generateNarrative(
        'project-1',
        'quest-project',
        10,
        'blockchain',
        stats
      )

      // Should mention level achievement
      expect(narrative.milestonesSection.some(p => p.includes('Level 10'))).toBe(true)
      expect(narrative.milestonesSection.some(p => p.includes('10 levels'))).toBe(true)

      // Should mention quests
      expect(narrative.milestonesSection.some(p => p.includes('5 quests completed'))).toBe(true)
      expect(narrative.milestonesSection.some(p => p.includes('20 phases'))).toBe(true)

      // Should mention tool mastery
      expect(narrative.milestonesSection.some(p => p.includes('Edit'))).toBe(true)
      expect(narrative.milestonesSection.some(p => p.includes('Bash'))).toBe(true)
    })

    test('generates valid markdown document', () => {
      const stats = createEmptyTeamStats()
      stats.totalXp = 1000
      stats.uniquePersonas = 1
      stats.personaContributions = [
        createContribution('Cipher', 1000, 100, 10),
      ]
      stats.gitStats.totalCommits = 10

      const narrative = generateNarrative(
        'project-1',
        'markdown-test',
        3,
        'infra',
        stats
      )

      // Markdown should have proper structure
      expect(narrative.markdown).toContain('# markdown-test: A Story of Code')
      expect(narrative.markdown).toContain('*Level 3 infra project*')
      expect(narrative.markdown).toContain('## The Team')
      expect(narrative.markdown).toContain('## The Work')
      expect(narrative.markdown).toContain('## Milestones')
      expect(narrative.markdown).toContain('---')
    })

    test('handles project at level 1 (no level milestone)', () => {
      const stats = createEmptyTeamStats()
      stats.totalXp = 50
      stats.uniquePersonas = 1
      stats.personaContributions = [
        createContribution('Cipher', 50, 100, 1),
      ]
      stats.topTools = { 'Edit': 5 }

      const narrative = generateNarrative(
        'project-1',
        'new-project',
        1,
        'unknown',
        stats
      )

      // Should not have level achievement for level 1
      const hasLevelMilestone = narrative.milestonesSection.some(p =>
        p.includes('Level 1 Achievement')
      )
      expect(hasLevelMilestone).toBe(false)

      // Should still have tool mastery
      expect(narrative.milestonesSection.some(p => p.includes('Edit'))).toBe(true)
    })

    test('handles project with only tool usage (no git activity)', () => {
      const stats = createEmptyTeamStats()
      stats.totalXp = 500
      stats.uniquePersonas = 1
      stats.personaContributions = [
        createContribution('Cipher', 500, 100, 0, ['Read', 'Grep']),
      ]
      stats.topTools = { 'Read': 50, 'Grep': 30 }

      const narrative = generateNarrative(
        'project-1',
        'read-only-project',
        2,
        'unknown',
        stats
      )

      // Should still generate meaningful content
      expect(narrative.teamSection.length).toBeGreaterThan(0)
      expect(narrative.activitySection.length).toBeGreaterThan(0)

      // Should mention 0 commits gracefully (in the activity section)
      expect(narrative.activitySection.some(p => p.includes('0 commits'))).toBe(true)
    })
  })
})

describe('Narrative Structure', () => {
  test('all sections return string arrays', () => {
    const stats = createEmptyTeamStats()
    const narrative = generateNarrative(
      'test',
      'test-project',
      1,
      'unknown',
      stats
    )

    expect(Array.isArray(narrative.teamSection)).toBe(true)
    expect(Array.isArray(narrative.activitySection)).toBe(true)
    expect(Array.isArray(narrative.milestonesSection)).toBe(true)

    narrative.teamSection.forEach(p => expect(typeof p).toBe('string'))
    narrative.activitySection.forEach(p => expect(typeof p).toBe('string'))
    narrative.milestonesSection.forEach(p => expect(typeof p).toBe('string'))
  })

  test('markdown is a single string', () => {
    const stats = createEmptyTeamStats()
    const narrative = generateNarrative(
      'test',
      'test-project',
      1,
      'unknown',
      stats
    )

    expect(typeof narrative.markdown).toBe('string')
    expect(narrative.markdown.length).toBeGreaterThan(0)
  })

  test('NarrativeSummary has all required fields', () => {
    const stats = createEmptyTeamStats()
    const narrative = generateNarrative(
      'test',
      'test-project',
      1,
      'unknown',
      stats
    )

    const expectedKeys: (keyof NarrativeSummary)[] = [
      'title',
      'tagline',
      'teamSection',
      'activitySection',
      'milestonesSection',
      'markdown',
    ]

    expectedKeys.forEach(key => {
      expect(narrative).toHaveProperty(key)
    })
  })
})
