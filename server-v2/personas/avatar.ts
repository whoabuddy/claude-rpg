/**
 * Avatar generation using Bitcoin faces
 */

import { createLogger } from '../lib/logger'

const log = createLogger('avatar')

const BITCOIN_FACES_URL = 'https://bitcoinfaces.xyz/api/face'
const FETCH_TIMEOUT = 5000
const MAX_RETRIES = 2

/**
 * Fetch a Bitcoin face avatar for a session
 * Returns URL or null if unavailable
 */
export async function fetchBitcoinFace(sessionId: string): Promise<string | null> {
  // Generate a deterministic seed from session ID
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash) + sessionId.charCodeAt(i)
    hash = hash & hash
  }
  const seed = Math.abs(hash)

  const url = `${BITCOIN_FACES_URL}?seed=${seed}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

      const response = await fetch(url, {
        method: 'HEAD', // Just check if URL is valid
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        log.debug('Avatar URL generated', { sessionId, url })
        return url
      }

      if (response.status >= 400 && response.status < 500) {
        // Client error - don't retry
        log.warn('Avatar service returned client error', {
          sessionId,
          status: response.status,
        })
        return null
      }

      // Server error - will retry
      log.warn('Avatar service returned server error', {
        sessionId,
        status: response.status,
        attempt,
      })
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError'
      log.warn('Avatar fetch failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        isTimeout,
        attempt,
      })
    }

    // Wait before retry
    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }

  log.warn('Avatar fetch exhausted retries', { sessionId })
  return null
}

/**
 * Generate a fallback avatar URL (identicon-style)
 */
export function getFallbackAvatarUrl(sessionId: string): string {
  // Use a simple identicon service as fallback
  const hash = sessionId.substring(0, 8)
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${hash}`
}
