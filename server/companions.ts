import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID, createHash } from 'crypto'
import { DEFAULTS } from '../shared/defaults.js'
import type { Companion, CompanionStats, StreakInfo } from '../shared/types.js'
import { detectRepoInfo } from './utils.js'
import { createDefaultStreak } from './competitions.js'

// ═══════════════════════════════════════════════════════════════════════════
// English First Names (for Claude sessions)
// ═══════════════════════════════════════════════════════════════════════════

const ENGLISH_NAMES = [
  // A
  'Ada', 'Agnes', 'Albert', 'Alice', 'Alma', 'Amos', 'Anna', 'Archer', 'Arthur', 'Astrid',
  'Audrey', 'August', 'Aurora', 'Avery', 'Abigail',
  // B
  'Barnaby', 'Basil', 'Beatrice', 'Benedict', 'Benjamin', 'Bernadette', 'Bertram', 'Bianca',
  'Blake', 'Bonnie', 'Boris', 'Bridget', 'Bruno', 'Bryce', 'Bob',
  // C
  'Calvin', 'Camille', 'Carlton', 'Caroline', 'Casper', 'Catherine', 'Cecil', 'Celeste',
  'Charlie', 'Chester', 'Clara', 'Clarence', 'Clifford', 'Clive', 'Conrad', 'Cordelia', 'Cyrus',
  // D
  'Dagmar', 'Dallas', 'Daniel', 'Daphne', 'Darcy', 'Deirdre', 'Delilah', 'Desmond', 'Diana',
  'Dolores', 'Dominic', 'Doris', 'Douglas', 'Duncan', 'Dustin',
  // E
  'Edgar', 'Edith', 'Edmund', 'Edward', 'Edwin', 'Eleanor', 'Elias', 'Eloise', 'Emmett',
  'Enid', 'Ernest', 'Esther', 'Eugene', 'Evelyn', 'Ezra',
  // F
  'Felicity', 'Felix', 'Fergus', 'Fern', 'Fiona', 'Fletcher', 'Flora', 'Floyd', 'Frances',
  'Franklin', 'Frederick', 'Freya',
  // G
  'Gabriel', 'Garrett', 'Gemma', 'Genevieve', 'George', 'Gerald', 'Gideon', 'Gilbert',
  'Gladys', 'Gloria', 'Gordon', 'Grace', 'Graham', 'Greta', 'Gwendolyn',
  // H
  'Hadley', 'Hannah', 'Harold', 'Harriet', 'Harvey', 'Hazel', 'Hector', 'Helen', 'Henry',
  'Herbert', 'Homer', 'Howard', 'Hugo', 'Humphrey',
  // I
  'Ida', 'Ignatius', 'Imogen', 'Ingrid', 'Irene', 'Iris', 'Irving', 'Isaac', 'Isolde', 'Ivan',
  // J
  'Jasper', 'James', 'Jerome', 'Josephine', 'Joyce', 'Julia', 'Julius', 'Juniper',
  // K
  'Katherine', 'Keaton', 'Keith', 'Kenneth', 'Kevin', 'Kieran', 'Knox',
  // L
  'Lachlan', 'Laura', 'Lawrence', 'Leander', 'Leonard', 'Leopold', 'Lester', 'Lillian',
  'Lionel', 'Lorraine', 'Lucille', 'Luther', 'Lydia',
  // M
  'Mabel', 'Malcolm', 'Marcel', 'Margaret', 'Marion', 'Martin', 'Matilda', 'Maurice',
  'Maxine', 'Melvin', 'Michael', 'Mildred', 'Milton', 'Miriam', 'Monroe', 'Mortimer', 'Myrtle',
  // N
  'Nancy', 'Nathaniel', 'Neville', 'Nolan', 'Nora', 'Norman', 'Norris',
  // O
  'Octavia', 'Oliver', 'Olivia', 'Ophelia', 'Orson', 'Oscar', 'Oswald', 'Otto', 'Owen',
  // P
  'Palmer', 'Patricia', 'Patrick', 'Pauline', 'Penelope', 'Percival', 'Perry', 'Phoebe',
  'Porter', 'Preston', 'Priscilla', 'Prudence',
  // Q
  'Quentin', 'Quincy', 'Quinn',
  // R
  'Rachel', 'Ramona', 'Randolph', 'Raymond', 'Regina', 'Reginald', 'Renata', 'Rhett',
  'Robert', 'Roland', 'Rosalind', 'Roscoe', 'Rowena', 'Rupert', 'Russell', 'Ruth',
  // S
  'Sabrina', 'Samuel', 'Sarah', 'Sawyer', 'Sebastian', 'Selma', 'Seymour', 'Sheldon',
  'Silas', 'Simon', 'Solomon', 'Spencer', 'Stanley', 'Sterling', 'Stuart', 'Sylvia',
  // T
  'Tabitha', 'Teresa', 'Theodore', 'Thomas', 'Tobias', 'Truman',
  // U
  'Ulysses', 'Ursula',
  // V
  'Valentina', 'Vaughn', 'Vera', 'Vernon', 'Victor', 'Vincent', 'Viola', 'Virginia', 'Vivian',
  // W
  'Wallace', 'Walter', 'Warren', 'Wendell', 'Wendy', 'Wesley', 'Wilbur', 'William',
  'Winifred', 'Winston',
  // X-Z
  'Xavier', 'Yvonne', 'Zachary', 'Zelda', 'Zoe',
]

// Deterministic name from session ID, with collision avoidance
export function getSessionName(sessionId: string, activeNames?: Set<string>): string {
  const hash = createHash('md5').update(sessionId).digest()
  const index = hash.readUInt16BE(0) % ENGLISH_NAMES.length
  const baseName = ENGLISH_NAMES[index]

  // No collision tracking requested, or name is available
  if (!activeNames || !activeNames.has(baseName)) {
    return baseName
  }

  // Try secondary hash bytes for an alternative name
  for (let offset = 2; offset < 14; offset += 2) {
    const altIndex = hash.readUInt16BE(offset) % ENGLISH_NAMES.length
    const altName = ENGLISH_NAMES[altIndex]
    if (!activeNames.has(altName)) {
      return altName
    }
  }

  // All hash-based names collide — append numeric suffix
  let suffix = 2
  while (activeNames.has(`${baseName} ${suffix}`)) {
    suffix++
  }
  return `${baseName} ${suffix}`
}

// Bitcoin face URL (cached SVG fetched separately)
function getBitcoinFaceUrl(sessionId: string): string {
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
    quests: {
      created: 0,
      phasesCompleted: 0,
      questsCompleted: 0,
      totalRetries: 0,
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

  // Detect npm scripts from package.json (#45)
  const npmScripts = detectNpmScripts(repoInfo.path)

  // Create new companion - use repo name as the companion name
  const companion: Companion = {
    id: randomUUID(),
    name: repoInfo.name,
    repo: repoInfo,
    level: 1,
    experience: 0,
    totalExperience: 0,
    stats: createDefaultStats(),
    streak: createDefaultStreak(),
    npmScripts: npmScripts || undefined,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  }

  companions.push(companion)
  console.log(`[claude-rpg] Created new companion for ${repoInfo.name}${npmScripts ? ` (${Object.keys(npmScripts).length} npm scripts)` : ''}`)

  return companion
}

/**
 * Detect available npm scripts from package.json (#45)
 */
function detectNpmScripts(repoPath: string): Record<string, string> | null {
  try {
    const pkgPath = join(resolve(repoPath), 'package.json')
    if (!existsSync(pkgPath)) return null

    const content = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)
    if (pkg.scripts && typeof pkg.scripts === 'object') {
      return pkg.scripts as Record<string, string>
    }
  } catch {
    // package.json read/parse failed, skip
  }
  return null
}

/**
 * Refresh npm scripts for an existing companion
 * Called periodically or on demand
 */
export function refreshNpmScripts(companion: Companion): boolean {
  const scripts = detectNpmScripts(companion.repo.path)
  if (scripts) {
    companion.npmScripts = scripts
    return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════════════════════

// Ensure companion has all required fields (migration for existing data)
function migrateCompanion(companion: Partial<Companion>): Companion {
  return {
    ...companion,
    streak: companion.streak || createDefaultStreak(),
  } as Companion
}

export function loadCompanions(dataDir: string): Companion[] {
  const file = join(dataDir, DEFAULTS.COMPANIONS_FILE)

  if (!existsSync(file)) {
    return []
  }

  try {
    const content = readFileSync(file, 'utf-8')
    const data = JSON.parse(content)
    const companions = data.companions || []
    // Migrate existing companions to ensure all fields exist
    return companions.map(migrateCompanion)
  } catch (e) {
    console.error(`[claude-rpg] Error loading companions:`, e)
    return []
  }
}

export function saveCompanions(dataDir: string, companions: Companion[]) {
  const file = join(dataDir, DEFAULTS.COMPANIONS_FILE)
  const tmpFile = file + '.tmp'

  try {
    writeFileSync(tmpFile, JSON.stringify({ companions }, null, 2))
    renameSync(tmpFile, file)
  } catch (e) {
    console.error(`[claude-rpg] Error saving companions:`, e)
  }
}
