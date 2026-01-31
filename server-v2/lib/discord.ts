/**
 * Discord webhook notifications (server-side)
 */

import { createLogger } from './logger'

const log = createLogger('discord')

// Default webhook URL - can be overridden by environment variable
const DEFAULT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1467013881799901206/HIIOYh7xGtS5VA7pCxxPUIemNSO7X2k61vRmmEtqHYgxYb8IpeBNRCokP5D11qUfH24Q'

// Embed colors (Discord uses decimal)
const COLORS = {
  waiting: 0xfbbf24,    // amber-400
  complete: 0x22c55e,   // green-500
  error: 0xef4444,      // red-500
  achievement: 0xeab308, // yellow-500
  levelUp: 0x8b5cf6,    // violet-500
  info: 0x6b7280,       // gray-500
}

type NotificationType = 'waiting' | 'complete' | 'error' | 'achievement' | 'levelUp' | 'info'

interface DiscordEmbed {
  title: string
  description?: string
  color: number
  timestamp?: string
  footer?: { text: string }
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}

interface DiscordPayload {
  username?: string
  avatar_url?: string
  embeds: DiscordEmbed[]
}

/**
 * Get the Discord webhook URL from environment or default
 */
function getWebhookUrl(): string | null {
  return process.env.DISCORD_WEBHOOK_URL || DEFAULT_WEBHOOK_URL
}

/**
 * Check if Discord notifications are enabled
 */
export function isDiscordEnabled(): boolean {
  const url = getWebhookUrl()
  return !!url && url.startsWith('https://discord.com/api/webhooks/')
}

/**
 * Send a notification to Discord
 */
export async function sendDiscordNotification(
  type: NotificationType,
  title: string,
  description?: string,
  fields?: Array<{ name: string; value: string; inline?: boolean }>
): Promise<boolean> {
  const webhook = getWebhookUrl()
  if (!webhook) {
    log.debug('Discord webhook not configured')
    return false
  }

  const payload: DiscordPayload = {
    username: 'Claude RPG',
    embeds: [{
      title,
      description,
      color: COLORS[type] || COLORS.info,
      timestamp: new Date().toISOString(),
      footer: { text: 'Claude RPG Companion' },
      fields,
    }],
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      log.warn('Discord webhook failed', { status: response.status })
      return false
    }

    log.debug('Discord notification sent', { type, title })
    return true
  } catch (error) {
    log.warn('Discord webhook error', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/**
 * Notify Discord when Claude needs input
 */
export function notifyWaiting(sessionName: string, repoName?: string, question?: string): void {
  if (!isDiscordEnabled()) return

  const fields = []
  if (repoName) fields.push({ name: 'Project', value: repoName, inline: true })

  sendDiscordNotification(
    'waiting',
    `${sessionName} needs input`,
    question || 'Waiting for response...',
    fields.length > 0 ? fields : undefined
  )
}

/**
 * Notify Discord when Claude encounters an error
 */
export function notifyError(sessionName: string, errorInfo: string, repoName?: string): void {
  if (!isDiscordEnabled()) return

  const fields = []
  if (repoName) fields.push({ name: 'Project', value: repoName, inline: true })

  sendDiscordNotification(
    'error',
    `${sessionName} error`,
    errorInfo,
    fields.length > 0 ? fields : undefined
  )
}

/**
 * Notify Discord when Claude completes a task
 */
export function notifyComplete(sessionName: string, repoName?: string): void {
  if (!isDiscordEnabled()) return

  sendDiscordNotification(
    'complete',
    `${sessionName} finished`,
    repoName ? `Completed work on ${repoName}` : 'Task completed'
  )
}

/**
 * Notify Discord when an achievement is unlocked
 */
export function notifyAchievement(achievementName: string, companionName: string): void {
  if (!isDiscordEnabled()) return

  sendDiscordNotification(
    'achievement',
    `Achievement Unlocked!`,
    `**${achievementName}**\nUnlocked by ${companionName}`
  )
}

/**
 * Notify Discord when a level up occurs
 */
export function notifyLevelUp(companionName: string, newLevel: number): void {
  if (!isDiscordEnabled()) return

  sendDiscordNotification(
    'levelUp',
    `Level Up!`,
    `**${companionName}** reached level ${newLevel}`
  )
}
