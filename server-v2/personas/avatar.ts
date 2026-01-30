/**
 * Avatar generation using Bitcoin faces with local caching
 */

import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createLogger } from '../lib/logger'
import { getConfig } from '../lib/config'

const log = createLogger('avatar')

const BITCOIN_FACES_URL = 'https://bitcoinfaces.xyz/api/get-image'
const FETCH_TIMEOUT = 5000
const MAX_RETRIES = 2

/**
 * Ensure avatars directory exists
 */
function ensureAvatarsDir(): string {
  const config = getConfig()
  const avatarsDir = join(config.dataDir, 'avatars')

  if (!existsSync(avatarsDir)) {
    mkdirSync(avatarsDir, { recursive: true })
    log.info('Created avatars directory', { path: avatarsDir })
  }

  return avatarsDir
}

/**
 * Generate a deterministic seed string from session ID
 */
function generateSeed(sessionId: string): string {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash) + sessionId.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString()
}

/**
 * Fetch a Bitcoin face avatar for a session
 * Returns local API URL or null if unavailable
 */
export async function fetchBitcoinFace(sessionId: string): Promise<string | null> {
  const seed = generateSeed(sessionId)
  const avatarsDir = ensureAvatarsDir()
  const cachePath = join(avatarsDir, `${seed}.svg`)

  // Check if avatar is already cached
  if (existsSync(cachePath)) {
    log.debug('Avatar found in cache', { sessionId, seed })
    return `/api/avatars/${seed}`
  }

  // Fetch from bitcoinfaces.xyz API
  const url = `${BITCOIN_FACES_URL}?name=${seed}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

      const response = await fetch(url, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        // Read SVG content
        const svgContent = await response.text()

        // Save to cache
        await Bun.write(cachePath, svgContent)

        log.debug('Avatar fetched and cached', { sessionId, seed })
        return `/api/avatars/${seed}`
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
