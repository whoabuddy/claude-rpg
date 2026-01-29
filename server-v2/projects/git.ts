/**
 * Git repository detection and info
 */

import { createLogger } from '../lib/logger'
import type { GitRepoInfo } from './types'

const log = createLogger('git')

// Cache git info for 5 seconds
const infoCache = new Map<string, { info: GitRepoInfo; timestamp: number }>()
const CACHE_TTL = 5000

/**
 * Check if a path is a git repository
 */
export async function isGitRepo(path: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['git', 'rev-parse', '--git-dir'], {
      cwd: path,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    return exitCode === 0
  } catch {
    return false
  }
}

/**
 * Get git repository information
 */
export async function getRepoInfo(path: string): Promise<GitRepoInfo | null> {
  // Check cache
  const cached = infoCache.get(path)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.info
  }

  try {
    // Get repository root name
    const nameProc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
      cwd: path,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const nameOutput = await new Response(nameProc.stdout).text()
    const repoPath = nameOutput.trim()
    const name = repoPath.split('/').pop() || 'unknown'

    // Get current branch
    const branchProc = Bun.spawn(['git', 'branch', '--show-current'], {
      cwd: path,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const branchOutput = await new Response(branchProc.stdout).text()
    const branch = branchOutput.trim() || 'HEAD'

    // Get remote URL
    const remoteProc = Bun.spawn(['git', 'remote', 'get-url', 'origin'], {
      cwd: path,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const remoteOutput = await new Response(remoteProc.stdout).text()
    const remote = remoteOutput.trim() || null

    // Check dirty status
    const statusProc = Bun.spawn(['git', 'status', '--porcelain'], {
      cwd: path,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const statusOutput = await new Response(statusProc.stdout).text()
    const isDirty = statusOutput.trim().length > 0

    // Get ahead/behind counts
    let ahead = 0
    let behind = 0

    const revListProc = Bun.spawn(
      ['git', 'rev-list', '--left-right', '--count', `@{upstream}...HEAD`],
      {
        cwd: path,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    )
    const revListOutput = await new Response(revListProc.stdout).text()
    const [behindStr, aheadStr] = revListOutput.trim().split(/\s+/)
    if (aheadStr) ahead = parseInt(aheadStr, 10) || 0
    if (behindStr) behind = parseInt(behindStr, 10) || 0

    const info: GitRepoInfo = {
      name,
      branch,
      remote,
      isDirty,
      ahead,
      behind,
    }

    // Cache the result
    infoCache.set(path, { info, timestamp: Date.now() })

    log.debug('Got repo info', { path, name, branch, isDirty })
    return info
  } catch (error) {
    log.warn('Failed to get repo info', {
      path,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Extract GitHub URL from remote
 */
export function extractGitHubUrl(remote: string | null): string | null {
  if (!remote) return null

  // Handle SSH format: git@github.com:user/repo.git
  const sshMatch = remote.match(/git@github\.com:(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}`
  }

  // Handle HTTPS format: https://github.com/user/repo.git
  const httpsMatch = remote.match(/https?:\/\/github\.com\/(.+?)(?:\.git)?$/)
  if (httpsMatch) {
    return `https://github.com/${httpsMatch[1]}`
  }

  return null
}

/**
 * Clear git info cache
 */
export function clearCache(): void {
  infoCache.clear()
}
