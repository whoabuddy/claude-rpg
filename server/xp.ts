import type { ClaudeEvent, Companion, XPGain, PreToolUseEvent, PostToolUseEvent, QuestEventType } from '../shared/types.js'
import { xpForLevel } from '../shared/types.js'
import type { QuestEventPayload } from './quests.js'

// ═══════════════════════════════════════════════════════════════════════════
// XP Rewards Configuration
// ═══════════════════════════════════════════════════════════════════════════

const XP_REWARDS = {
  tools: {
    Read: 1,
    Edit: 3,
    Write: 5,
    Bash: 2,
    Grep: 1,
    Glob: 1,
    Task: 5,
    WebFetch: 2,
    WebSearch: 2,
    TodoWrite: 1,
    AskUserQuestion: 1,
    default: 1,
  },
  tool_success_bonus: 1,
  question_answered: 2,
  session_completed: 10,

  git: {
    commit: 15,
    push: 10,
    pr_created: 20,
    pr_merged: 50,
    branch_created: 5,
  },

  commands: {
    test: 5,
    build: 3,
    deploy: 10,
    lint: 2,
  },

  blockchain: {
    clarinet_check: 5,
    clarinet_test: 8,
    testnet_deploy: 25,
    mainnet_deploy: 100,
  },

  quests: {
    phase_planned: 10,
    phase_verified_pass: 25,
    phase_verified_fail_retry: 5,
    quest_completed: 100,
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════
// Command Detection
// ═══════════════════════════════════════════════════════════════════════════

interface CommandDetection {
  type: string
  xp: number
  statKey: string
}

export function detectCommandXP(command: string): CommandDetection | null {
  const cmd = command.toLowerCase()

  // Git operations
  if (cmd.includes('git commit')) {
    return { type: 'git.commit', xp: XP_REWARDS.git.commit, statKey: 'git.commits' }
  }
  if (cmd.includes('git push')) {
    return { type: 'git.push', xp: XP_REWARDS.git.push, statKey: 'git.pushes' }
  }
  if (cmd.includes('gh pr create')) {
    return { type: 'git.pr_created', xp: XP_REWARDS.git.pr_created, statKey: 'git.prsCreated' }
  }
  if (cmd.includes('gh pr merge')) {
    return { type: 'git.pr_merged', xp: XP_REWARDS.git.pr_merged, statKey: 'git.prsMerged' }
  }
  if (/git checkout -b|git switch -c/.test(cmd)) {
    return { type: 'git.branch', xp: XP_REWARDS.git.branch_created, statKey: 'git.branches' }
  }

  // Testing
  if (/npm (run )?test|pnpm test|vitest|jest|pytest|cargo test|go test/.test(cmd)) {
    return { type: 'commands.test', xp: XP_REWARDS.commands.test, statKey: 'commands.testsRun' }
  }

  // Building
  if (/npm run build|pnpm build|tsc|cargo build|go build|make\b/.test(cmd)) {
    return { type: 'commands.build', xp: XP_REWARDS.commands.build, statKey: 'commands.buildsRun' }
  }

  // Deploying (non-blockchain)
  if (/wrangler|npm run wrangler|vercel|netlify deploy|npm run deploy/.test(cmd)) {
    return { type: 'commands.deploy', xp: XP_REWARDS.commands.deploy, statKey: 'commands.deploysRun' }
  }

  // Linting
  if (/npm run lint|eslint|prettier|cargo clippy|cargo fmt/.test(cmd)) {
    return { type: 'commands.lint', xp: XP_REWARDS.commands.lint, statKey: 'commands.lintsRun' }
  }

  // Blockchain - Clarinet
  if (cmd.includes('clarinet check')) {
    return { type: 'blockchain.check', xp: XP_REWARDS.blockchain.clarinet_check, statKey: 'blockchain.clarinetChecks' }
  }
  if (cmd.includes('clarinet test')) {
    return { type: 'blockchain.test', xp: XP_REWARDS.blockchain.clarinet_test, statKey: 'blockchain.clarinetTests' }
  }
  if (/clarinet deploy.*--testnet|stx deploy.*testnet/.test(cmd)) {
    return { type: 'blockchain.testnet', xp: XP_REWARDS.blockchain.testnet_deploy, statKey: 'blockchain.testnetDeploys' }
  }
  if (/clarinet deploy.*--mainnet|stx deploy.*mainnet/.test(cmd)) {
    return { type: 'blockchain.mainnet', xp: XP_REWARDS.blockchain.mainnet_deploy, statKey: 'blockchain.mainnetDeploys' }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Processing
// ═══════════════════════════════════════════════════════════════════════════

export function processEvent(companion: Companion, event: ClaudeEvent): XPGain | null {
  companion.lastActivity = event.timestamp

  // Session state management is now in index.ts
  // This function focuses on XP and stats tracking

  switch (event.type) {
    case 'pre_tool_use':
      return processPreToolUse(companion, event as PreToolUseEvent)

    case 'post_tool_use':
      return processPostToolUse(companion, event as PostToolUseEvent)

    case 'stop':
      companion.stats.sessionsCompleted++
      return awardXP(companion, XP_REWARDS.session_completed, 'session', 'Session completed')

    case 'user_prompt_submit':
      companion.stats.promptsReceived++
      return null

    default:
      return null
  }
}

function processPreToolUse(companion: Companion, event: PreToolUseEvent): XPGain | null {
  // Track tool usage in stats
  companion.stats.toolsUsed[event.tool] = (companion.stats.toolsUsed[event.tool] || 0) + 1

  // Award XP for tool use
  const toolXP = XP_REWARDS.tools[event.tool as keyof typeof XP_REWARDS.tools] || XP_REWARDS.tools.default
  return awardXP(companion, toolXP, `tool.${event.tool}`, `Used ${event.tool}`)
}

function processPostToolUse(companion: Companion, event: PostToolUseEvent): XPGain | null {

  let totalXP = 0
  let xpType = 'tool_complete'
  let description = `${event.tool} completed`

  // Success bonus
  if (event.success) {
    totalXP += XP_REWARDS.tool_success_bonus
  }

  // Check for special commands in Bash
  if (event.tool === 'Bash' && event.success) {
    // Get command from event (toolInput is added during normalization)
    const eventWithInput = event as PostToolUseEvent & { toolInput?: { command?: string } }
    const command = eventWithInput.toolInput?.command || ''

    const commandXP = detectCommandXP(command)
    if (commandXP) {
      totalXP += commandXP.xp
      xpType = commandXP.type
      description = getCommandDescription(commandXP.type, command)

      // Update stats based on command type
      incrementStat(companion.stats, commandXP.statKey)
    }
  }

  if (totalXP > 0) {
    return awardXP(companion, totalXP, xpType, description)
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function awardXP(companion: Companion, amount: number, type: string, description: string): XPGain {
  companion.experience += amount
  companion.totalExperience += amount

  // Check for level up - recalculate xpNeeded each iteration for multi-level ups
  while (companion.experience >= xpForLevel(companion.level)) {
    companion.experience -= xpForLevel(companion.level)
    companion.level++
    console.log(`[claude-rpg] ${companion.name} leveled up to ${companion.level}!`)
  }

  return {
    companionId: companion.id,
    companionName: companion.name,
    amount,
    type,
    description,
    timestamp: Date.now(),
  }
}

function incrementStat(stats: Companion['stats'], path: string) {
  const parts = path.split('.')
  let obj: Record<string, unknown> = stats as unknown as Record<string, unknown>

  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]] as Record<string, unknown>
  }

  const key = parts[parts.length - 1]
  obj[key] = ((obj[key] as number) || 0) + 1
}

// ═══════════════════════════════════════════════════════════════════════════
// Quest XP Processing
// ═══════════════════════════════════════════════════════════════════════════

export function processQuestXP(companion: Companion, event: QuestEventPayload): XPGain | null {
  switch (event.type) {
    case 'phase_planned':
      incrementStat(companion.stats, 'quests.created')
      return awardXP(companion, XP_REWARDS.quests.phase_planned, 'quest.phase_planned', 'Phase planned')

    case 'phase_verified':
      if (event.result === 'pass') {
        incrementStat(companion.stats, 'quests.phasesCompleted')
        return awardXP(companion, XP_REWARDS.quests.phase_verified_pass, 'quest.phase_verified', 'Phase verified!')
      } else {
        incrementStat(companion.stats, 'quests.totalRetries')
        return awardXP(companion, XP_REWARDS.quests.phase_verified_fail_retry, 'quest.phase_retry', 'Phase retry')
      }

    case 'quest_completed':
      incrementStat(companion.stats, 'quests.questsCompleted')
      return awardXP(companion, XP_REWARDS.quests.quest_completed, 'quest.completed', 'Quest complete!')

    default:
      return null
  }
}

function getCommandDescription(type: string, command: string): string {
  switch (type) {
    case 'git.commit': return 'Git commit'
    case 'git.push': return 'Git push'
    case 'git.pr_created': return 'PR created'
    case 'git.pr_merged': return 'PR merged'
    case 'commands.test': return 'Tests run'
    case 'commands.build': return 'Build completed'
    case 'commands.deploy': return 'Deploy triggered'
    case 'blockchain.check': return 'Clarinet check'
    case 'blockchain.test': return 'Clarinet test'
    case 'blockchain.testnet': return 'Testnet deploy'
    case 'blockchain.mainnet': return 'Mainnet deploy!'
    default: return command.slice(0, 30)
  }
}
