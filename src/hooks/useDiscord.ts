/**
 * Discord webhook hook
 */

import { useState, useEffect, useCallback } from 'react'
import { getDiscordWebhook, setDiscordWebhook, isDiscordConfigured, sendDiscordNotification } from '../lib/discord'

interface UseDiscordResult {
  webhookUrl: string
  isConfigured: boolean
  setWebhook: (url: string) => void
  testWebhook: () => Promise<boolean>
}

export function useDiscord(): UseDiscordResult {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)

  // Load initial state
  useEffect(() => {
    setWebhookUrl(getDiscordWebhook())
    setIsConfigured(isDiscordConfigured())
  }, [])

  const setWebhook = useCallback((url: string) => {
    setDiscordWebhook(url)
    setWebhookUrl(url)
    setIsConfigured(url.startsWith('https://discord.com/api/webhooks/'))
  }, [])

  const testWebhook = useCallback(async () => {
    if (!isDiscordConfigured()) return false
    return sendDiscordNotification(
      'info',
      'Test Notification',
      'Discord notifications are working! You\'ll receive alerts when Claude needs input.'
    )
  }, [])

  return { webhookUrl, isConfigured, setWebhook, testWebhook }
}
