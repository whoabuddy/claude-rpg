import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { join, basename } from 'path'
import type { RepoInfo, TmuxWindow, TmuxPane } from '../shared/types.js'

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
