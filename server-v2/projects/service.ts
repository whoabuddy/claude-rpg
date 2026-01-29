/**
 * Project service
 */

import { createLogger } from '../lib/logger'
import { queries } from '../db'
import { isGitRepo, getRepoInfo, extractGitHubUrl } from './git'
import type { Project, ProjectClass } from './types'

const log = createLogger('project-service')

/**
 * Get or create a project for a path
 * Returns null if path is not a git repo
 */
export async function getOrCreateProject(path: string): Promise<Project | null> {
  // Check if it's a git repo
  const isRepo = await isGitRepo(path)
  if (!isRepo) {
    log.debug('Path is not a git repo', { path })
    return null
  }

  // Get repo info
  const repoInfo = await getRepoInfo(path)
  if (!repoInfo) {
    log.warn('Could not get repo info', { path })
    return null
  }

  // Check if project already exists
  const existing = queries.getProjectByPath.get(path) as Record<string, unknown> | null

  if (existing) {
    log.debug('Found existing project', { path, id: existing.id })
    return mapDbToProject(existing)
  }

  // Create new project
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const githubUrl = extractGitHubUrl(repoInfo.remote)

  queries.insertProject.run(
    id,
    path,
    repoInfo.name,
    githubUrl,
    'unknown' as ProjectClass,
    0, // total_xp
    1, // level
    now, // created_at
    now  // last_activity_at
  )

  log.info('Created new project', { id, path, name: repoInfo.name, githubUrl })

  return {
    id,
    path,
    name: repoInfo.name,
    githubUrl,
    projectClass: 'unknown',
    totalXp: 0,
    level: 1,
    createdAt: now,
    lastActivityAt: now,
  }
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity(projectId: string): void {
  const now = new Date().toISOString()
  queries.updateProjectLastActivity.run(now, projectId)
  log.debug('Updated last activity', { projectId })
}

/**
 * Get all active projects (activity in last 24 hours)
 */
export function getActiveProjects(): Project[] {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const results = queries.getActiveProjects.all(oneDayAgo) as Array<Record<string, unknown>>
  return results.map(mapDbToProject)
}

/**
 * Get all projects
 */
export function getAllProjects(): Project[] {
  const results = queries.getAllProjects.all() as Array<Record<string, unknown>>
  return results.map(mapDbToProject)
}

/**
 * Get project by ID
 */
export function getProjectById(id: string): Project | null {
  const result = queries.getProjectById.get(id) as Record<string, unknown> | null
  return result ? mapDbToProject(result) : null
}

/**
 * Get project by path
 */
export function getProjectByPath(path: string): Project | null {
  const result = queries.getProjectByPath.get(path) as Record<string, unknown> | null
  return result ? mapDbToProject(result) : null
}

/**
 * Add XP to a project
 */
export function addXp(projectId: string, amount: number): void {
  queries.addProjectXp.run(amount, projectId)

  // Check for level up
  const project = getProjectById(projectId)
  if (project) {
    const newLevel = calculateLevel(project.totalXp + amount)
    if (newLevel > project.level) {
      queries.updateProjectLevel.run(newLevel, projectId)
      log.info('Project leveled up', { projectId, oldLevel: project.level, newLevel })
    }
  }
}

/**
 * Classify project based on XP distribution
 */
export function classifyProject(projectId: string): ProjectClass {
  // Get XP events for this project
  const events = queries.getXpEventsByProject.all(projectId) as Array<Record<string, unknown>>

  if (events.length === 0) {
    return 'unknown'
  }

  // Count by event type
  const counts: Record<string, number> = {}
  for (const event of events) {
    const type = event.event_type as string
    counts[type] = (counts[type] || 0) + 1
  }

  // Determine class based on dominant activities
  const frontendIndicators = ['Write:*.tsx', 'Write:*.jsx', 'Write:*.css', 'Write:*.scss']
  const backendIndicators = ['Write:*.ts', 'Write:*.js', 'Write:*.py', 'Write:*.go']
  const infraIndicators = ['Write:*.yaml', 'Write:*.yml', 'Write:*.tf', 'Write:*.dockerfile']
  const blockchainIndicators = ['Write:*.clar', 'Write:*.sol']

  let frontendScore = 0
  let backendScore = 0
  let infraScore = 0
  let blockchainScore = 0

  for (const [type, count] of Object.entries(counts)) {
    if (frontendIndicators.some(i => type.includes(i.replace('*', '')))) {
      frontendScore += count
    }
    if (backendIndicators.some(i => type.includes(i.replace('*', '')))) {
      backendScore += count
    }
    if (infraIndicators.some(i => type.includes(i.replace('*', '')))) {
      infraScore += count
    }
    if (blockchainIndicators.some(i => type.includes(i.replace('*', '')))) {
      blockchainScore += count
    }
  }

  // Determine classification
  if (blockchainScore > 0 && blockchainScore >= Math.max(frontendScore, backendScore, infraScore)) {
    return 'blockchain'
  }
  if (infraScore > 0 && infraScore >= Math.max(frontendScore, backendScore)) {
    return 'infra'
  }
  if (frontendScore > 0 && backendScore > 0 && Math.abs(frontendScore - backendScore) < frontendScore * 0.3) {
    return 'fullstack'
  }
  if (frontendScore > backendScore) {
    return 'frontend'
  }
  if (backendScore > frontendScore) {
    return 'backend'
  }

  return 'unknown'
}

/**
 * Calculate level from XP
 */
function calculateLevel(xp: number): number {
  // Each level requires 100 * level XP
  let level = 1
  let xpNeeded = 0

  while (xp >= xpNeeded) {
    xpNeeded += 100 * level
    if (xp >= xpNeeded) {
      level++
    }
  }

  return level
}

/**
 * Map database row to Project type
 */
function mapDbToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    path: row.path as string,
    name: row.name as string,
    githubUrl: row.github_url as string | null,
    projectClass: row.project_class as ProjectClass,
    totalXp: row.total_xp as number,
    level: row.level as number,
    createdAt: row.created_at as string,
    lastActivityAt: row.last_activity_at as string,
  }
}
