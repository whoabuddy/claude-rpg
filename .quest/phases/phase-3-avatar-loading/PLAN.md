# Phase 3: Fix Avatar Loading

## Goal

Avatars load reliably using the correct bitcoinfaces.xyz API with local disk caching and proper error fallback in the UI.

## Context

Current issues:
1. **Wrong API URL**: Using `bitcoinfaces.xyz/api/face` but correct endpoint is `bitcoinfaces.xyz/api/get-image/<string>` which returns SVG directly
2. **Dicebear fallback**: `getFallbackAvatarUrl()` falls back to dicebear.com - should be removed
3. **No caching**: Every request goes to external API; should cache SVGs locally on disk
4. **No UI error handling**: `PaneAvatar.tsx` has no `onError` fallback when images fail to load

Correct API behavior:
- `GET https://bitcoinfaces.xyz/api/get-image/<string>` returns raw SVG content
- The `<string>` can be any text (use sessionId hash as before)
- Response is `Content-Type: image/svg+xml`

Data directory: `~/.claude-rpg/` (from `config.dataDir`)

Files involved:
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/personas/avatar.ts` - Avatar fetching logic
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/routes.ts` - Route definitions
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/handlers.ts` - Request handlers
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneAvatar.tsx` - Avatar display

---

<plan>
  <goal>Fix avatar loading with correct API, local caching, and UI error handling</goal>
  <context>
    The avatar system currently stores URLs in the database (avatar_url column in personas table).
    The PaneAvatar component already handles both URL-based and inline SVG avatars via the
    avatarSvg property. The session-builder maps persona.avatarUrl to session.avatarSvg.

    New approach: Store cached SVG content locally, serve via API endpoint, fallback to initials.
  </context>

  <task id="1">
    <name>Fix avatar fetching and implement local caching</name>
    <files>
      /home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/personas/avatar.ts
    </files>
    <action>
      Rewrite avatar.ts to:

      1. Change API URL constant:
         ```typescript
         const BITCOIN_FACES_URL = 'https://bitcoinfaces.xyz/api/get-image'
         ```

      2. Create avatars cache directory on startup:
         ```typescript
         import { getConfig } from '../lib/config'
         import { mkdir, readFile, writeFile } from 'fs/promises'
         import { join } from 'path'

         function getAvatarCacheDir(): string {
           return join(getConfig().dataDir, 'avatars')
         }

         export async function ensureAvatarCacheDir(): Promise<void> {
           await mkdir(getAvatarCacheDir(), { recursive: true })
         }
         ```

      3. Replace fetchBitcoinFace() to:
         - Generate seed from sessionId (keep existing hash logic)
         - Build URL: `${BITCOIN_FACES_URL}/${seed}`
         - Check if cached file exists at `${cacheDir}/${seed}.svg`
         - If cached, return local path identifier (e.g., `/api/avatars/${seed}`)
         - If not cached, fetch GET request (not HEAD), read response body as text
         - Save SVG content to cache file
         - Return local path identifier
         - On any error, return null (no fallback URL)

      4. Remove getFallbackAvatarUrl() entirely - no dicebear fallback

      5. Add function to get cached SVG content:
         ```typescript
         export async function getCachedAvatar(seed: string): Promise<string | null> {
           const filePath = join(getAvatarCacheDir(), `${seed}.svg`)
           try {
             return await readFile(filePath, 'utf-8')
           } catch {
             return null
           }
         }
         ```

      6. Add function to extract seed from session ID for API endpoint:
         ```typescript
         export function getAvatarSeed(sessionId: string): string {
           let hash = 0
           for (let i = 0; i < sessionId.length; i++) {
             hash = ((hash << 5) - hash) + sessionId.charCodeAt(i)
             hash = hash & hash
           }
           return String(Math.abs(hash))
         }
         ```
    </action>
    <verify>
      Run TypeScript compiler to check for errors:
      ```bash
      cd /home/whoabuddy/dev/whoabuddy/claude-rpg && npx tsc --noEmit server-v2/personas/avatar.ts
      ```

      Manually test the bitcoinfaces API:
      ```bash
      curl -s "https://bitcoinfaces.xyz/api/get-image/12345" | head -c 200
      ```
      Should return SVG content starting with `<svg`.
    </verify>
    <done>
      avatar.ts uses correct API URL, fetches and caches SVG content locally,
      returns local API path for cached avatars, and removes dicebear fallback.
    </done>
  </task>

  <task id="2">
    <name>Add API endpoint to serve cached avatars</name>
    <files>
      /home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/routes.ts
      /home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/handlers.ts
      /home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/personas/service.ts
    </files>
    <action>
      1. Add route in routes.ts:
         ```typescript
         { method: 'GET', pattern: '/api/avatars/:seed', handler: 'getAvatar' },
         ```

      2. Add handler in handlers.ts:
         ```typescript
         import { getCachedAvatar } from '../personas'

         export async function getAvatar(params: Record<string, string>): Promise<Response> {
           const svg = await getCachedAvatar(params.seed)

           if (!svg) {
             // Return a simple placeholder SVG with initials "?"
             const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
               <circle cx="50" cy="50" r="45" fill="#374151"/>
               <text x="50" y="50" text-anchor="middle" dy=".35em" fill="#9CA3AF" font-size="40" font-family="sans-serif">?</text>
             </svg>`
             return new Response(placeholder, {
               status: 200,
               headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' },
             })
           }

           return new Response(svg, {
             status: 200,
             headers: {
               'Content-Type': 'image/svg+xml',
               'Cache-Control': 'public, max-age=31536000, immutable',
             },
           })
         }
         ```

         Note: This handler returns a Response directly, not ApiResponse. Update the
         api/index.ts routing logic if needed to handle raw Response returns.

      3. Update persona service to use new avatar path format:
         In service.ts, change the avatar URL assignment:
         ```typescript
         // After successful fetch:
         avatarUrl = `/api/avatars/${seed}`  // Local path, not external URL
         ```

      4. Export getCachedAvatar from personas/index.ts:
         ```typescript
         export { getCachedAvatar, getAvatarSeed, ensureAvatarCacheDir } from './avatar'
         ```

      5. Call ensureAvatarCacheDir() during server startup in server-v2/index.ts
    </action>
    <verify>
      Start the server and test the endpoint:
      ```bash
      # In one terminal
      cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun run server-v2/index.ts

      # In another terminal
      curl -I http://localhost:4011/api/avatars/12345
      ```
      Should return Content-Type: image/svg+xml (placeholder if not cached, real avatar if cached).
    </verify>
    <done>
      New /api/avatars/:seed endpoint serves cached SVG content with proper caching headers,
      returns placeholder SVG when not found, and persona service stores local paths.
    </done>
  </task>

  <task id="3">
    <name>Add error handling to PaneAvatar component</name>
    <files>
      /home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneAvatar.tsx
    </files>
    <action>
      Update PaneAvatar.tsx to handle image load errors:

      1. Add useState for tracking load errors:
         ```typescript
         import { memo, useState } from 'react'
         ```

      2. In the component, add state:
         ```typescript
         const [imgError, setImgError] = useState(false)
         ```

      3. Update the img tag to handle errors:
         ```typescript
         if (isUrl && !imgError) {
           return (
             <img
               src={session.avatarSvg}
               alt={session.name}
               className={`${dimension} rounded-full bg-rpg-bg flex-shrink-0`}
               onError={() => setImgError(true)}
             />
           )
         }
         ```

      4. When imgError is true OR no avatarSvg, fall back to initials:
         ```typescript
         // After the URL/SVG checks, the existing initials fallback handles both cases
         return (
           <div className={`${dimension} rounded-full bg-rpg-accent/30 flex items-center justify-center ${fontSize} font-bold flex-shrink-0`}>
             {session.name[0]}
           </div>
         )
         ```

      5. The inline SVG case (dangerouslySetInnerHTML) should remain unchanged since
         local SVG content won't fail to render. But verify the avatarSvg no longer
         contains URLs - it should be either a local /api/avatars/... path or empty.
    </action>
    <verify>
      Run the client build and check for TypeScript errors:
      ```bash
      cd /home/whoabuddy/dev/whoabuddy/claude-rpg && bun run build
      ```

      Manual test: Start server, open UI, verify:
      - New Claude sessions show avatars (fetched and cached)
      - Existing sessions show avatars (from cache)
      - If avatar API fails, shows initial letter fallback
    </verify>
    <done>
      PaneAvatar gracefully handles image load failures by falling back to the
      initial letter display, eliminating broken image icons.
    </done>
  </task>
</plan>

## Commit Messages

After completing all tasks:

1. `fix(avatars): use correct bitcoinfaces API and add local caching`
2. `feat(api): add endpoint to serve cached avatars`
3. `fix(ui): add error fallback to PaneAvatar component`

Or as a single commit:
`fix(avatars): correct API URL, add local caching, and UI error handling`
