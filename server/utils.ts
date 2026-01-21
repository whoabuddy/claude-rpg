import { existsSync } from 'fs'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import { join, basename } from 'path'
import type { RepoInfo, TmuxWindow, TmuxPane } from '../shared/types.js'

const execAsync = promisify(exec)

// ═══════════════════════════════════════════════════════════════════════════
// Git Repo Detection (shared between tmux.ts and companions.ts)
// ═══════════════════════════════════════════════════════════════════════════

export function detectRepoInfo(cwd: string): RepoInfo | undefined {
  if (!cwd) return undefined

  try {
    // Find git root directory
    let repoRoot = cwd
    if (!existsSync(join(cwd, '.git'))) {
      // Try to find .git in parent directories
      let current = cwd
      while (current !== '/') {
        if (existsSync(join(current, '.git'))) {
          repoRoot = current
          break
        }
        current = join(current, '..')
      }
      if (!existsSync(join(repoRoot, '.git'))) {
        return undefined
      }
    }

    // Get remote URL
    let remote: string | undefined
    let org: string | undefined
    let name: string

    try {
      remote = execSync('git remote get-url origin', {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()

      // Parse org/name from remote
      // git@github.com:org/repo.git or https://github.com/org/repo.git
      const match = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
      if (match) {
        org = match[1]
        name = match[2]
      } else {
        name = basename(repoRoot)
      }
    } catch {
      // No remote, use directory name
      name = basename(repoRoot)
    }

    return {
      path: repoRoot,
      remote,
      org,
      name,
    }
  } catch {
    return undefined
  }
}

/**
 * Enrich RepoInfo with git status (async)
 * Called periodically to update branch, ahead/behind, dirty status
 */
export async function enrichRepoWithGitStatus(repo: RepoInfo): Promise<RepoInfo> {
  const cwd = repo.path
  const opts = { cwd, timeout: 2000 }

  try {
    // Run git commands in parallel for speed
    const [branchResult, statusResult, upstreamResult, defaultBranchResult] = await Promise.allSettled([
      // Current branch
      execAsync('git branch --show-current', opts),
      // Dirty status (has changes)
      execAsync('git status --porcelain', opts),
      // Upstream remote (for forks)
      execAsync('git remote get-url upstream', opts),
      // Default branch (check if main or master exists)
      execAsync('git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo "refs/remotes/origin/main"', opts),
    ])

    // Current branch
    if (branchResult.status === 'fulfilled') {
      repo.branch = branchResult.value.stdout.trim() || undefined
    }

    // Dirty status
    if (statusResult.status === 'fulfilled') {
      repo.isDirty = statusResult.value.stdout.trim().length > 0
    }

    // Default branch
    if (defaultBranchResult.status === 'fulfilled') {
      const ref = defaultBranchResult.value.stdout.trim()
      repo.defaultBranch = ref.split('/').pop() || 'main'
    }

    // Upstream (fork info)
    if (upstreamResult.status === 'fulfilled') {
      const upstreamRemote = upstreamResult.value.stdout.trim()
      if (upstreamRemote) {
        const match = upstreamRemote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
        if (match) {
          repo.upstream = {
            org: match[1],
            name: match[2],
            remote: upstreamRemote,
          }
        }
      }
    }

    // Ahead/behind (only if we have a branch and origin)
    if (repo.branch && repo.remote) {
      try {
        const trackingBranch = repo.defaultBranch || 'main'
        const { stdout } = await execAsync(
          `git rev-list --left-right --count origin/${trackingBranch}...HEAD 2>/dev/null || echo "0 0"`,
          opts
        )
        const [behind, ahead] = stdout.trim().split(/\s+/).map(n => parseInt(n, 10) || 0)
        repo.ahead = ahead
        repo.behind = behind
      } catch {
        // No tracking branch or other error
      }
    }
  } catch {
    // Git commands failed, return repo as-is
  }

  return repo
}

// Cache for git status to avoid frequent git calls
const gitStatusCache = new Map<string, { repo: RepoInfo; timestamp: number }>()
const GIT_STATUS_CACHE_TTL = 5000 // 5 seconds

/**
 * Get enriched repo info with caching
 */
export async function getEnrichedRepoInfo(repo: RepoInfo): Promise<RepoInfo> {
  const cached = gitStatusCache.get(repo.path)
  const now = Date.now()

  if (cached && now - cached.timestamp < GIT_STATUS_CACHE_TTL) {
    return cached.repo
  }

  const enriched = await enrichRepoWithGitStatus({ ...repo })
  gitStatusCache.set(repo.path, { repo: enriched, timestamp: now })
  return enriched
}

// ═══════════════════════════════════════════════════════════════════════════
// Pane Finding Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generic pane finder using a predicate function
 */
export function findPane(
  windows: TmuxWindow[],
  predicate: (pane: TmuxPane) => boolean
): TmuxPane | undefined {
  for (const window of windows) {
    for (const pane of window.panes) {
      if (predicate(pane)) {
        return pane
      }
    }
  }
  return undefined
}

/**
 * Find pane by tmux target (session:window.pane format)
 */
export function findPaneByTarget(
  windows: TmuxWindow[],
  target: string
): TmuxPane | undefined {
  return findPane(windows, pane => pane.target === target)
}

/**
 * Find pane by pane ID
 */
export function findPaneById(
  windows: TmuxWindow[],
  paneId: string
): TmuxPane | undefined {
  return findPane(windows, pane => pane.id === paneId)
}

/**
 * Get all Claude panes across all windows
 */
export function getClaudePanes(windows: TmuxWindow[]): TmuxPane[] {
  const panes: TmuxPane[] = []
  for (const window of windows) {
    for (const pane of window.panes) {
      if (pane.process.type === 'claude') {
        panes.push(pane)
      }
    }
  }
  return panes
}
