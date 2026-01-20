import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join, basename } from 'path'
import { randomUUID } from 'crypto'
import { DEFAULTS } from '../shared/defaults.js'
import type { Companion, RepoInfo, CompanionStats, CompanionState } from '../shared/types.js'

// ═══════════════════════════════════════════════════════════════════════════
// Companion Names (RPG-style)
// ═══════════════════════════════════════════════════════════════════════════

const COMPANION_NAMES = [
  'Sparky', 'Atlas', 'Nova', 'Pixel', 'Echo',
  'Blaze', 'Frost', 'Sage', 'Bolt', 'Luna',
  'Cipher', 'Flux', 'Glitch', 'Neon', 'Orbit',
  'Pulse', 'Quark', 'Rune', 'Shade', 'Vex',
  'Warp', 'Xenon', 'Yeti', 'Zephyr', 'Axiom',
]

function getRandomName(existingNames: string[]): string {
  const available = COMPANION_NAMES.filter(n => !existingNames.includes(n))
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)]
  }
  // Fallback: append number to name
  const base = COMPANION_NAMES[Math.floor(Math.random() * COMPANION_NAMES.length)]
  return `${base}${Math.floor(Math.random() * 100)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Git Repo Detection
// ═══════════════════════════════════════════════════════════════════════════

function detectRepoInfo(cwd: string): RepoInfo | null {
  try {
    // Check if it's a git repo
    const gitDir = join(cwd, '.git')
    if (!existsSync(gitDir)) {
      // Try to find .git in parent directories
      let current = cwd
      while (current !== '/') {
        if (existsSync(join(current, '.git'))) {
          cwd = current
          break
        }
        current = join(current, '..')
      }
      if (!existsSync(join(cwd, '.git'))) {
        return null
      }
    }

    // Get remote URL
    let remote: string | undefined
    let org: string | undefined
    let name: string

    try {
      remote = execSync('git remote get-url origin', { cwd, encoding: 'utf-8' }).trim()

      // Parse org/name from remote
      // git@github.com:org/repo.git or https://github.com/org/repo.git
      const match = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
      if (match) {
        org = match[1]
        name = match[2]
      } else {
        name = basename(cwd)
      }
    } catch {
      // No remote, use directory name
      name = basename(cwd)
    }

    return {
      path: cwd,
      remote,
      org,
      name,
    }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Companion Management
// ═══════════════════════════════════════════════════════════════════════════

function createDefaultStats(): CompanionStats {
  return {
    toolsUsed: {},
    promptsReceived: 0,
    sessionsCompleted: 0,
    git: {
      commits: 0,
      pushes: 0,
      prsCreated: 0,
      prsMerged: 0,
    },
    commands: {
      testsRun: 0,
      buildsRun: 0,
      deploysRun: 0,
    },
    blockchain: {
      clarinetChecks: 0,
      clarinetTests: 0,
      testnetDeploys: 0,
      mainnetDeploys: 0,
    },
  }
}

function createDefaultState(): CompanionState {
  return {
    status: 'idle',
    lastActivity: Date.now(),
  }
}

export function findOrCreateCompanion(companions: Companion[], cwd: string): Companion | null {
  // Find existing companion by repo path
  const existing = companions.find(c => c.repo.path === cwd)
  if (existing) {
    return existing
  }

  // Check if this is a git repo
  const repoInfo = detectRepoInfo(cwd)
  if (!repoInfo) {
    // Not a git repo, skip
    return null
  }

  // Check if we have a companion for this repo (might be different cwd)
  const byRepoPath = companions.find(c => c.repo.path === repoInfo.path)
  if (byRepoPath) {
    return byRepoPath
  }

  // Create new companion
  const existingNames = companions.map(c => c.name)
  const name = getRandomName(existingNames)

  const companion: Companion = {
    id: randomUUID(),
    name,
    repo: repoInfo,
    level: 1,
    experience: 0,
    totalExperience: 0,
    stats: createDefaultStats(),
    state: createDefaultState(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
  }

  companions.push(companion)
  console.log(`[claude-rpg] Created new companion "${name}" for ${repoInfo.name}`)

  return companion
}

// ═══════════════════════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════════════════════

export function loadCompanions(dataDir: string): Companion[] {
  const file = join(dataDir, DEFAULTS.COMPANIONS_FILE)

  if (!existsSync(file)) {
    return []
  }

  try {
    const content = readFileSync(file, 'utf-8')
    const data = JSON.parse(content)
    return data.companions || []
  } catch (e) {
    console.error(`[claude-rpg] Error loading companions:`, e)
    return []
  }
}

export function saveCompanions(dataDir: string, companions: Companion[]) {
  const file = join(dataDir, DEFAULTS.COMPANIONS_FILE)

  try {
    writeFileSync(file, JSON.stringify({ companions }, null, 2))
  } catch (e) {
    console.error(`[claude-rpg] Error saving companions:`, e)
  }
}
