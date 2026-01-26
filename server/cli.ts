#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { DEFAULTS } from '../shared/defaults.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')
// Compiled to dist/server/server/cli.js → hooks at project root hooks/
const HOOK_SOURCE = join(__dirname, '..', '..', '..', 'hooks', 'claude-rpg-hook.sh')
const HOOK_DEST = join(homedir(), '.claude-rpg', 'hooks', 'claude-rpg-hook.sh')

async function setup() {
  console.log('Setting up Claude RPG...\n')

  // 1. Create directories
  const dataDir = DEFAULTS.DATA_DIR
  const hooksDir = dirname(HOOK_DEST)

  console.log('Creating directories...')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(hooksDir, { recursive: true })
  console.log(`  ✓ ${dataDir}`)
  console.log(`  ✓ ${hooksDir}`)

  // 2. Copy hook script
  console.log('\nInstalling hook script...')
  copyFileSync(HOOK_SOURCE, HOOK_DEST)

  // Make executable
  chmodSync(HOOK_DEST, 0o755)
  console.log(`  ✓ ${HOOK_DEST}`)

  // 3. Configure Claude Code hooks
  console.log('\nConfiguring Claude Code hooks...')

  const hookTypes = [
    'PreToolUse',
    'PostToolUse',
    'Stop',
    'UserPromptSubmit',
    'Notification',
  ]

  let settings: Record<string, unknown> = {}

  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'))
      console.log('  Found existing settings.json')
    } catch {
      console.log('  Could not parse existing settings.json, starting fresh')
    }
  }

  // Initialize hooks array if not present
  if (!Array.isArray(settings.hooks)) {
    settings.hooks = []
  }

  const hooks = settings.hooks as Array<{ matcher: string; hooks: string[] }>

  // Add our hooks
  for (const hookType of hookTypes) {
    const hookCommand = `${HOOK_DEST} ${hookType}`

    // Find existing matcher for this hook type
    const existing = hooks.find(h => h.matcher === hookType)

    if (existing) {
      // Add our hook if not already present
      if (!existing.hooks.includes(hookCommand)) {
        existing.hooks.push(hookCommand)
        console.log(`  ✓ Added to ${hookType}`)
      } else {
        console.log(`  - ${hookType} already configured`)
      }
    } else {
      // Create new hook entry
      hooks.push({
        matcher: hookType,
        hooks: [hookCommand],
      })
      console.log(`  ✓ Created ${hookType}`)
    }
  }

  // Ensure .claude directory exists
  mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true })

  // Write settings
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2))
  console.log(`  ✓ Saved ${CLAUDE_SETTINGS_PATH}`)

  console.log('\n✅ Setup complete!\n')
  console.log('Next steps:')
  console.log('  1. Start the server: npm run dev (or npx claude-rpg)')
  console.log('  2. Open http://localhost:4010 in your browser')
  console.log('  3. Start using Claude Code in any git repo')
  console.log('')
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'setup':
      await setup()
      break

    case 'start':
    case undefined:
      // Start server (index.ts auto-starts when imported)
      await import('./index.js')
      break

    case '--help':
    case '-h':
      console.log(`
Claude RPG - Mobile-first companion for Claude Code with RPG progression

Usage:
  claude-rpg           Start the server
  claude-rpg setup     Install hooks and configure Claude Code
  claude-rpg --help    Show this help message

Environment variables:
  CLAUDE_RPG_PORT      Server port (default: ${DEFAULTS.SERVER_PORT})
  CLAUDE_RPG_DATA_DIR  Data directory (default: ${DEFAULTS.DATA_DIR})
`)
      break

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Run "claude-rpg --help" for usage')
      process.exit(1)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
