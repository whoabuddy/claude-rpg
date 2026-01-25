/**
 * Password prompt detection utilities
 * Shared between PaneCard and FullScreenPane components
 */

// Patterns that indicate a password prompt in terminal output
export const PASSWORD_PATTERNS = [
  /\[sudo\] password for/i,
  /password:/i,
  /enter passphrase/i,
  /enter pin/i,
  /authentication required/i,
]

/**
 * Check if terminal content shows a password prompt
 * Looks at the last few lines of output
 */
export function isPasswordPrompt(terminalContent: string | undefined): boolean {
  if (!terminalContent) return false
  // Check last few lines for password prompt
  const lastLines = terminalContent.split('\n').slice(-5).join('\n')
  return PASSWORD_PATTERNS.some(pattern => pattern.test(lastLines))
}
