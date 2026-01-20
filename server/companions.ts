import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID, createHash } from 'crypto'
import { DEFAULTS } from '../shared/defaults.js'
import type { Companion, CompanionStats } from '../shared/types.js'
import { detectRepoInfo } from './utils.js'

// ═══════════════════════════════════════════════════════════════════════════
// English First Names (for Claude sessions)
// ═══════════════════════════════════════════════════════════════════════════

const ENGLISH_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Edward',
  'Fiona', 'George', 'Hannah', 'Isaac', 'Julia',
  'Kevin', 'Laura', 'Michael', 'Nancy', 'Oliver',
  'Patricia', 'Quinn', 'Robert', 'Sarah', 'Thomas',
  'Ursula', 'Victor', 'Wendy', 'Xavier', 'Yvonne',
  'Zachary', 'Abigail', 'Benjamin', 'Catherine', 'Daniel',
  'Eleanor', 'Franklin', 'Grace', 'Henry', 'Iris',
  'James', 'Katherine', 'Leonard', 'Margaret', 'Nathan',
  'Olivia', 'Patrick', 'Rachel', 'Samuel', 'Teresa',
  'Vincent', 'William', 'Zoe', 'Arthur', 'Beatrice',
]

// Deterministic name from session ID
export function getSessionName(sessionId: string): string {
  const hash = createHash('md5').update(sessionId).digest()
  const index = hash.readUInt16BE(0) % ENGLISH_NAMES.length
  return ENGLISH_NAMES[index]
}

// Bitcoin face URL (cached SVG fetched separately)
export function getBitcoinFaceUrl(sessionId: string): string {
  return `https://bitcoinfaces.xyz/api/get-image?name=${encodeURIComponent(sessionId)}`
}

// Fetch and cache Bitcoin face SVG
const bitcoinFaceCache = new Map<string, string>()

export async function fetchBitcoinFace(sessionId: string): Promise<string | undefined> {
  if (bitcoinFaceCache.has(sessionId)) {
    return bitcoinFaceCache.get(sessionId)
  }

  try {
    const url = getBitcoinFaceUrl(sessionId)
    const response = await fetch(url)
    if (response.ok) {
      const svg = await response.text()
      bitcoinFaceCache.set(sessionId, svg)
      return svg
    }
  } catch (e) {
    console.error(`[claude-rpg] Error fetching Bitcoin face for ${sessionId}:`, e)
  }
  return undefined
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
      lintsRun: 0,
    },
    blockchain: {
      clarinetChecks: 0,
      clarinetTests: 0,
      testnetDeploys: 0,
      mainnetDeploys: 0,
    },
  }
}

export function findOrCreateCompanion(companions: Companion[], cwd: string): Companion | undefined {
  // Find existing companion by repo path
  const existing = companions.find(c => c.repo.path === cwd)
  if (existing) {
    return existing
  }

  // Check if this is a git repo
  const repoInfo = detectRepoInfo(cwd)
  if (!repoInfo) {
    // Not a git repo, skip
    return undefined
  }

  // Check if we have a companion for this repo (might be different cwd)
  const byRepoPath = companions.find(c => c.repo.path === repoInfo.path)
  if (byRepoPath) {
    return byRepoPath
  }

  // Create new companion - use repo name as the companion name
  const companion: Companion = {
    id: randomUUID(),
    name: repoInfo.name,
    repo: repoInfo,
    level: 1,
    experience: 0,
    totalExperience: 0,
    stats: createDefaultStats(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
  }

  companions.push(companion)
  console.log(`[claude-rpg] Created new companion for ${repoInfo.name}`)

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
