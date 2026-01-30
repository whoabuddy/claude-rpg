/**
 * Avatar serving endpoint
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { createLogger } from '../lib/logger'
import { getConfig } from '../lib/config'

const log = createLogger('api:avatars')

/**
 * Serve cached avatar SVG
 */
export async function serveAvatar(seed: string): Promise<Response> {
  const config = getConfig()
  const avatarsDir = join(config.dataDir, 'avatars')
  const avatarPath = join(avatarsDir, `${seed}.svg`)

  // Check if avatar exists in cache
  if (existsSync(avatarPath)) {
    const file = Bun.file(avatarPath)
    const content = await file.text()

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
      },
    })
  }

  // Return placeholder SVG for missing avatars
  log.debug('Avatar not found in cache, returning placeholder', { seed })

  const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="50" fill="#374151"/>
  <text x="50" y="50" text-anchor="middle" dy="0.35em" font-family="sans-serif" font-size="48" fill="#9CA3AF">?</text>
</svg>`

  return new Response(placeholder, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    },
  })
}
