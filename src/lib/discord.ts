/**
 * Discord webhook notifications
 */

const DISCORD_WEBHOOK_KEY = 'claude-rpg-discord-webhook'

// Embed colors (Discord uses decimal, not hex)
const COLORS = {
  waiting: 0xfbbf24,   // amber-400
  complete: 0x22c55e,  // green-500
  error: 0xef4444,     // red-500
  achievement: 0xeab308, // yellow-500
  xp: 0xd97706,        // amber-600
  info: 0x6b7280,      // gray-500
}

type NotificationType = 'waiting' | 'complete' | 'error' | 'achievement' | 'xp' | 'info'

interface DiscordEmbed {
  title: string
  description?: string
  color: number
  timestamp?: string
  footer?: { text: string }
}

interface DiscordPayload {
  username?: string
  avatar_url?: string
  embeds: DiscordEmbed[]
}

/**
 * Get the configured Discord webhook URL
 */
export function getDiscordWebhook(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(DISCORD_WEBHOOK_KEY) || ''
}

/**
 * Set the Discord webhook URL
 */
export function setDiscordWebhook(url: string): void {
  if (typeof localStorage === 'undefined') return
  if (url) {
    localStorage.setItem(DISCORD_WEBHOOK_KEY, url)
  } else {
    localStorage.removeItem(DISCORD_WEBHOOK_KEY)
  }
}

/**
 * Check if Discord notifications are configured
 */
export function isDiscordConfigured(): boolean {
  const webhook = getDiscordWebhook()
  return webhook.startsWith('https://discord.com/api/webhooks/')
}

/**
 * Send a notification to Discord
 */
export async function sendDiscordNotification(
  type: NotificationType,
  title: string,
  description?: string
): Promise<boolean> {
  const webhook = getDiscordWebhook()
  if (!webhook) return false

  const payload: DiscordPayload = {
    username: 'Claude RPG',
    embeds: [{
      title,
      description,
      color: COLORS[type] || COLORS.info,
      timestamp: new Date().toISOString(),
      footer: { text: 'Claude RPG Companion' },
    }],
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.warn('[claude-rpg] Discord webhook failed:', response.status)
      return false
    }

    return true
  } catch (error) {
    console.warn('[claude-rpg] Discord webhook error:', error)
    return false
  }
}

/**
 * Send notification to Discord if configured
 */
export function notifyDiscordIfConfigured(
  type: NotificationType,
  title: string,
  description?: string
): void {
  if (isDiscordConfigured()) {
    // Fire and forget - don't block on Discord
    sendDiscordNotification(type, title, description)
  }
}
