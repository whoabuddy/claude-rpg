/**
 * Tmux command batching utilities
 *
 * Reduces multiple tmux exec calls into single commands using \; separator.
 * Based on patterns from webmux and tmux-sessionizer.
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Characters safe for send-keys -l (literal mode)
// Literal mode handles most printable characters but not control sequences
const SAFE_FOR_LITERAL = /^[a-zA-Z0-9 .,_+=@/:?-]*$/

interface TmuxCommand {
  command: string
  args?: string[]
}

/**
 * Execute multiple tmux commands in a single shell invocation
 * Commands are joined with \; separator
 *
 * @example
 * await batchCommands([
 *   { command: 'send-keys', args: ['-l', '-t', '"%1"', '"hello"'] },
 *   { command: 'send-keys', args: ['-t', '"%1"', 'Enter'] }
 * ])
 * // Executes: tmux send-keys -l -t "%1" "hello" \; send-keys -t "%1" Enter
 */
export async function batchCommands(
  commands: TmuxCommand[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  if (commands.length === 0) {
    return { stdout: '', stderr: '' }
  }

  const timeout = options.timeout ?? 5000

  // Build command string with \; separators
  const parts = commands.map(cmd => {
    if (cmd.args && cmd.args.length > 0) {
      return `${cmd.command} ${cmd.args.join(' ')}`
    }
    return cmd.command
  })

  const fullCommand = `tmux ${parts.join(' \\; ')}`

  try {
    return await execAsync(fullCommand, { timeout })
  } catch (error) {
    // Re-throw with more context
    const e = error as Error & { stdout?: string; stderr?: string }
    throw new Error(
      `Tmux batch command failed: ${e.message}\nCommand: ${fullCommand}\n` +
      `stdout: ${e.stdout || ''}\nstderr: ${e.stderr || ''}`
    )
  }
}

/**
 * Check if a string is safe to send with send-keys -l (literal mode)
 * Literal mode is preferred for simple text as it avoids temp file overhead
 */
export function isSafeForLiteral(text: string): boolean {
  // Must be under 100 chars and contain only safe characters
  return text.length < 100 && SAFE_FOR_LITERAL.test(text)
}

/**
 * Escape text for use in double-quoted shell strings
 */
export function escapeForShell(text: string): string {
  // In double quotes, escape: $ ` " \ and !
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/!/g, '\\!')
}

/**
 * Send text to a tmux pane using literal mode when possible
 * Falls back to regular send-keys for complex text
 *
 * @param target - tmux pane target
 * @param text - text to send (without Enter)
 * @param options.withEnter - append Enter key after text
 */
export async function sendKeysLiteral(
  target: string,
  text: string,
  options: { withEnter?: boolean; timeout?: number } = {}
): Promise<void> {
  const { withEnter = false, timeout = 5000 } = options

  if (!text) {
    // Empty text with Enter = just press Enter
    if (withEnter) {
      await execAsync(`tmux send-keys -t "${target}" Enter`, { timeout })
    }
    return
  }

  if (isSafeForLiteral(text)) {
    // Safe for literal mode - batch with Enter if needed
    const commands: TmuxCommand[] = [
      { command: 'send-keys', args: ['-l', `-t "${target}"`, `"${text}"`] }
    ]

    if (withEnter) {
      commands.push({ command: 'send-keys', args: [`-t "${target}"`, 'Enter'] })
    }

    await batchCommands(commands, { timeout })
  } else {
    // Has special characters - use escaped version with regular send-keys
    // Note: For very complex text, the buffer approach in sendPromptToTmux is better
    const escaped = escapeForShell(text)
    const commands: TmuxCommand[] = [
      { command: 'send-keys', args: [`-t "${target}"`, `"${escaped}"`] }
    ]

    if (withEnter) {
      commands.push({ command: 'send-keys', args: [`-t "${target}"`, 'Enter'] })
    }

    await batchCommands(commands, { timeout })
  }
}

/**
 * Send a single key or key sequence to a tmux pane
 */
export async function sendKey(
  target: string,
  key: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options
  await execAsync(`tmux send-keys -t "${target}" ${key}`, { timeout })
}

/**
 * Batch multiple send-keys commands for different targets
 * Useful when sending to multiple panes at once
 */
export async function sendKeysToMultiplePanes(
  targets: Array<{ target: string; keys: string }>,
  options: { timeout?: number } = {}
): Promise<void> {
  const commands: TmuxCommand[] = targets.map(({ target, keys }) => ({
    command: 'send-keys',
    args: [`-t "${target}"`, keys]
  }))

  await batchCommands(commands, options)
}

/**
 * Batch buffer operations (load + paste) for complex text
 * Returns the commands to execute - caller handles temp file lifecycle
 */
export function buildBufferCommands(
  bufferName: string,
  target: string,
  tempFilePath: string
): TmuxCommand[] {
  return [
    { command: 'load-buffer', args: [`-b ${bufferName}`, tempFilePath] },
    { command: 'paste-buffer', args: [`-b ${bufferName}`, `-t "${target}"`] },
    { command: 'delete-buffer', args: [`-b ${bufferName}`] }
  ]
}
