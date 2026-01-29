/**
 * Static file serving for production.
 * Serves built client files from dist/client/.
 */

import { resolve, extname } from 'path'
import { existsSync } from 'fs'

// Path to client build (relative to server-v2/)
const CLIENT_DIR = resolve(import.meta.dir, '../../dist/client')

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
}

/**
 * Check if client build exists
 */
export function hasClientBuild(): boolean {
  return existsSync(resolve(CLIENT_DIR, 'index.html'))
}

/**
 * Serve a static file from the client build directory.
 * Returns null if the file doesn't exist.
 */
export async function serveStatic(pathname: string): Promise<Response | null> {
  // Normalize pathname
  let filePath = pathname === '/' ? '/index.html' : pathname

  // Security: prevent directory traversal
  if (filePath.includes('..')) {
    return null
  }

  const fullPath = resolve(CLIENT_DIR, filePath.slice(1)) // Remove leading /

  // Check if file exists
  const file = Bun.file(fullPath)
  if (!await file.exists()) {
    return null
  }

  // Get MIME type
  const ext = extname(fullPath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  // Cache headers
  const isHashed = pathname.includes('/assets/') // Hashed assets
  const cacheControl = isHashed
    ? 'public, max-age=31536000, immutable' // 1 year for hashed assets
    : 'no-cache' // No cache for index.html

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    },
  })
}

/**
 * Serve index.html for SPA fallback.
 * Used when a route doesn't match API or static file.
 */
export async function serveSpaFallback(): Promise<Response | null> {
  const indexPath = resolve(CLIENT_DIR, 'index.html')
  const file = Bun.file(indexPath)

  if (!await file.exists()) {
    return null
  }

  return new Response(file, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
