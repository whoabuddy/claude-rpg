/**
 * Terminal pattern registry for Claude Code detection
 *
 * COMPATIBILITY NOTES:
 * - Last verified with Claude Code v1.x (Jan 2026)
 * - Check Claude Code release notes for terminal UI changes
 * - Test patterns after any Claude Code update
 */

export interface Pattern {
  name: string
  regex: RegExp
  confidence: number
}

/**
 * Patterns indicating Claude is waiting for user input
 */
export const WAITING_PATTERNS: Pattern[] = [
  // Permission prompts
  {
    name: 'bash_permission',
    regex: /Allow.*\(Bash\)|Run this command\?|Allow.*command/i,
    confidence: 0.95,
  },
  {
    name: 'edit_permission',
    regex: /Allow.*\(Edit\)|Allow.*edit|Approve.*changes/i,
    confidence: 0.95,
  },
  {
    name: 'write_permission',
    regex: /Allow.*\(Write\)|Create.*file\?/i,
    confidence: 0.95,
  },
  {
    name: 'generic_permission',
    regex: /Allow|Deny|Yes|No.*\[y\/n\]/i,
    confidence: 0.7,
  },

  // Question prompts
  {
    name: 'question_prompt',
    regex: /\?\s*$|\?\s*\n\s*[>\-•]/m,
    confidence: 0.6,
  },
  {
    name: 'choice_prompt',
    regex: /\d+\.\s+.+\n\d+\.\s+/m,
    confidence: 0.8,
  },
  {
    name: 'arrow_choices',
    regex: /[►▶→]\s+.+\n\s*[►▶→]\s+/m,
    confidence: 0.85,
  },

  // Plan mode
  {
    name: 'plan_mode',
    regex: /Plan Mode|Approve.*plan|Review.*plan/i,
    confidence: 0.9,
  },
]

/**
 * Patterns indicating Claude is actively working
 */
export const WORKING_PATTERNS: Pattern[] = [
  // Spinner characters
  {
    name: 'spinner',
    regex: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/,
    confidence: 0.9,
  },
  {
    name: 'dots_spinner',
    regex: /\.{2,}$/m,
    confidence: 0.5,
  },

  // Activity indicators
  {
    name: 'thinking',
    regex: /Thinking\.\.\.|Working\.\.\.|Processing\.\.\./i,
    confidence: 0.85,
  },
  {
    name: 'tool_executing',
    regex: /Running|Executing|Reading|Writing|Searching/i,
    confidence: 0.7,
  },
  {
    name: 'agent_working',
    regex: /Agent.*working|Subagent.*running/i,
    confidence: 0.85,
  },
]

/**
 * Patterns indicating idle/ready state
 */
export const IDLE_PATTERNS: Pattern[] = [
  // Completion indicators
  {
    name: 'task_complete',
    regex: /Task complete|Done|Finished|Complete!/i,
    confidence: 0.7,
  },
  {
    name: 'checkmark',
    regex: /[✓✔☑]/,
    confidence: 0.6,
  },

  // Ready prompt
  {
    name: 'claude_prompt',
    regex: /Claude.*>\s*$/m,
    confidence: 0.8,
  },
  {
    name: 'shell_prompt',
    regex: /[$%#>]\s*$/m,
    confidence: 0.4,
  },
]

/**
 * Patterns indicating an error occurred
 */
export const ERROR_PATTERNS: Pattern[] = [
  // Error messages
  {
    name: 'error_message',
    regex: /Error:|ERROR:|Failed:|FAILED:/i,
    confidence: 0.8,
  },
  {
    name: 'tool_failed',
    regex: /Tool.*failed|Command.*failed|Exit code [1-9]/i,
    confidence: 0.85,
  },

  // Rate limiting
  {
    name: 'rate_limit',
    regex: /rate limit|too many requests|quota exceeded/i,
    confidence: 0.9,
  },

  // Permission denied
  {
    name: 'permission_denied',
    regex: /permission denied|access denied|unauthorized/i,
    confidence: 0.75,
  },
]

/**
 * Patterns for extracting prompt options
 */
export const OPTION_PATTERNS = {
  numbered: /^\s*(\d+)\.\s+(.+)$/gm,
  bulleted: /^\s*[•\-\*]\s+(.+)$/gm,
  arrowed: /^\s*[►▶→]\s+(.+)$/gm,
}
