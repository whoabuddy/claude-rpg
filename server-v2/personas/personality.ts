/**
 * Personality generation for personas
 */

export interface PersonaPersonality {
  backstory: string | null
  quirk: string | null
}

// Backstory templates keyed by dominant stat
const BACKSTORIES: Record<string, string[]> = {
  files_edited: [
    'A meticulous code editor who treats every file like a work of art',
    'Former technical writer turned developer, obsessed with clean refactors',
    'Self-taught hacker who learned by rewriting every tutorial they found',
  ],
  tests_run: [
    'QA engineer who believes every bug is a test case waiting to be written',
    'TDD evangelist who writes tests before breakfast',
    'Former game tester who treats production code like a speedrun',
  ],
  commits_created: [
    'Git historian who believes every commit tells a story',
    'Serial committer who breaks down work into atomic changes',
    'Release manager who dreams in merge commits',
  ],
  bash_commands: [
    'Terminal wizard who types faster than they think',
    'Shell script poet who automates everything',
    'Command-line purist who refuses to use a mouse',
  ],
  files_written: [
    'Prolific creator who generates code like a printing press',
    'Documentation enthusiast who writes READMEs for their READMEs',
    'Rapid prototyper who turns ideas into files in seconds',
  ],
  clarity_files_edited: [
    'Blockchain native who thinks in smart contracts',
    'Clarity devotee who evangelizes Bitcoin DeFi',
    'Former Solidity dev who saw the light of Clarity',
  ],
}

const QUIRKS: string[] = [
  'Always uses single quotes',
  'Refuses to commit on Fridays',
  'Names variables after food',
  'Insists on Oxford commas in comments',
  'Uses tabs instead of spaces (controversial)',
  'Only works in dark mode',
  'Writes haiku in commit messages',
  'Uses emojis as function names',
  'Prefers snake_case for everything',
  'Runs tests three times for luck',
  'Always adds console.log then forgets to remove it',
  'Writes TODO comments but never finishes them',
  'Uses verbose variable names (like reallyDescriptiveVariableName)',
  'Deletes code by commenting it out first',
  'Uses semicolons in JavaScript even though they\'re optional',
]

/**
 * Generate a deterministic personality based on name hash
 */
export function generatePersonality(
  name: string,
  level: number,
  stats: Record<string, number>
): PersonaPersonality {
  // No backstory until level 5
  const backstory = level >= 5 ? selectBackstory(name, stats) : null

  // No quirk until level 10
  const quirk = level >= 10 ? selectQuirk(name) : null

  return { backstory, quirk }
}

function selectBackstory(name: string, stats: Record<string, number>): string {
  // Find dominant stat
  const entries = Object.entries(stats)
  if (entries.length === 0) {
    return 'A mysterious figure who appeared in the terminal one day'
  }

  const [dominantStat] = entries.reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  )

  // Get backstories for dominant stat
  const templates = BACKSTORIES[dominantStat] || BACKSTORIES.files_edited

  // Use name hash to select deterministic backstory
  const hash = simpleHash(name)
  const index = hash % templates.length
  return templates[index]
}

function selectQuirk(name: string): string {
  const hash = simpleHash(name)
  const index = hash % QUIRKS.length
  return QUIRKS[index]
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
