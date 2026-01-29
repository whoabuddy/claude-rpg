/**
 * GitHub repository cloning utilities
 */

import { createLogger } from '../lib/logger'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'

const log = createLogger('clone')

export interface CloneResult {
  success: boolean
  path?: string
  alreadyExists?: boolean
  error?: string
}

/**
 * Parse GitHub URL to extract org and repo
 * Supports:
 * - https://github.com/org/repo
 * - https://github.com/org/repo.git
 * - git@github.com:org/repo.git
 * - github.com/org/repo
 */
export function parseGitHubUrl(url: string): { org: string; repo: string } | null {
  try {
    // Normalize: remove trailing .git
    const normalized = url.replace(/\.git$/, '')

    // SSH format: git@github.com:org/repo
    const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/(.+)$/)
    if (sshMatch) {
      return { org: sshMatch[1], repo: sshMatch[2] }
    }

    // HTTPS format: https://github.com/org/repo
    const httpsMatch = normalized.match(/^https?:\/\/github\.com\/([^/]+)\/(.+)$/)
    if (httpsMatch) {
      return { org: httpsMatch[1], repo: httpsMatch[2] }
    }

    // Partial format: github.com/org/repo
    const partialMatch = normalized.match(/^github\.com\/([^/]+)\/(.+)$/)
    if (partialMatch) {
      return { org: partialMatch[1], repo: partialMatch[2] }
    }

    // Short format: org/repo
    const shortMatch = normalized.match(/^([^/]+)\/([^/]+)$/)
    if (shortMatch && !shortMatch[1].includes('.')) {
      return { org: shortMatch[1], repo: shortMatch[2] }
    }

    return null
  } catch (error) {
    log.warn('Failed to parse GitHub URL', {
      url,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Get target path for cloning: ~/dev/org/repo
 */
export function getTargetPath(org: string, repo: string): string {
  const homeDir = os.homedir()
  return path.join(homeDir, 'dev', org, repo)
}

/**
 * Clone a GitHub repository using gh CLI
 * Returns CloneResult with success status and path
 */
export async function cloneRepo(url: string): Promise<CloneResult> {
  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    return {
      success: false,
      error: `Invalid GitHub URL format: ${url}`,
    }
  }

  const { org, repo } = parsed
  const targetPath = getTargetPath(org, repo)

  // Check if target already exists
  try {
    await fs.access(targetPath)
    log.info('Repository already exists', { org, repo, path: targetPath })
    return {
      success: true,
      path: targetPath,
      alreadyExists: true,
    }
  } catch {
    // Target doesn't exist, proceed with clone
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(targetPath)
  try {
    await fs.mkdir(parentDir, { recursive: true })
  } catch (error) {
    return {
      success: false,
      error: `Failed to create parent directory: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // Clone using gh CLI
  log.info('Cloning repository', { org, repo, targetPath })

  try {
    const proc = Bun.spawn(['gh', 'repo', 'clone', `${org}/${repo}`, targetPath], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Set 60 second timeout
    const timeoutId = setTimeout(() => {
      proc.kill()
    }, 60000)

    const exitCode = await proc.exited
    clearTimeout(timeoutId)

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      return {
        success: false,
        error: `gh clone failed (exit ${exitCode}): ${stderr.trim()}`,
      }
    }

    log.info('Repository cloned successfully', { org, repo, path: targetPath })
    return {
      success: true,
      path: targetPath,
      alreadyExists: false,
    }
  } catch (error) {
    return {
      success: false,
      error: `Clone error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
