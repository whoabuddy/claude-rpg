# Phase 3: Fix Avatar Loading

## Goal
Avatars load reliably with correct API and local caching. Remove dicebear fallback.

## Context
- Current: Uses wrong API URL `bitcoinfaces.xyz/api/face`
- Correct: `bitcoinfaces.xyz/api/get-image/<string>` returns SVG content
- Dicebear fallback should be removed entirely
- Need local caching to avoid external requests on every load
- UI needs error handling when avatars fail to load

<plan>
  <goal>Fix avatar loading with correct API, local caching, and error handling</goal>
  <context>
    - bitcoinfaces.xyz/api/get-image/SEED returns raw SVG content
    - Store SVGs in ~/.claude-rpg/avatars/ directory
    - Serve via /api/avatars/:seed endpoint
    - Client uses local URL, falls back to initials on error
    - Config has dataDir for storage location
  </context>

  <task id="1">
    <name>Fix avatar fetching and implement local caching</name>
    <files>server-v2/personas/avatar.ts</files>
    <action>
      1. Change BITCOIN_FACES_URL from `/api/face` to `https://bitcoinfaces.xyz/api/get-image`
      2. Remove the dicebear fallback function entirely (getFallbackAvatarUrl)
      3. Change fetchBitcoinFace to:
         a. Generate a deterministic seed string from sessionId
         b. Check if avatar already cached: `{dataDir}/avatars/{seed}.svg`
         c. If cached, return `/api/avatars/{seed}` (local URL)
         d. If not cached, fetch from `https://bitcoinfaces.xyz/api/get-image/{seed}`
         e. Save SVG content to cache file
         f. Return `/api/avatars/{seed}` (local URL)
      4. Add helper to ensure avatars directory exists
      5. Return null on fetch failure (UI will show initials)
    </action>
    <verify>
      - bun run build passes
      - No dicebear references remain
      - Function returns local /api/avatars/:seed URLs
    </verify>
    <done>Avatar module fetches from correct API and caches locally</done>
  </task>

  <task id="2">
    <name>Add API endpoint to serve cached avatars</name>
    <files>server-v2/api/index.ts, server-v2/api/avatars.ts (new)</files>
    <action>
      1. Create server-v2/api/avatars.ts with handler:
         - GET /api/avatars/:seed
         - Read from {dataDir}/avatars/{seed}.svg
         - If exists: return with Content-Type: image/svg+xml and cache headers
         - If not exists: return placeholder SVG (gray circle with "?")
      2. In server-v2/api/index.ts, add route for /api/avatars/:seed
      3. Initialize avatars directory on server startup (in index.ts)
    </action>
    <verify>
      - Server starts without errors
      - curl /api/avatars/test returns SVG content-type
      - Missing avatars return placeholder
    </verify>
    <done>Server serves cached avatars via API endpoint</done>
  </task>

  <task id="3">
    <name>Add error handling to PaneAvatar component</name>
    <files>src/components/PaneAvatar.tsx</files>
    <action>
      1. Add React state: const [loadError, setLoadError] = useState(false)
      2. Add onError handler to img tag: onError={() => setLoadError(true)}
      3. Reset error state when avatarSvg changes: useEffect to setLoadError(false)
      4. When loadError is true OR avatarSvg is null, show initials fallback
      5. The initials fallback already exists (session.name[0])
    </action>
    <verify>
      - bun run build passes
      - Component handles missing/broken images gracefully
    </verify>
    <done>PaneAvatar shows initials when avatar fails to load</done>
  </task>
</plan>

## Commit Messages
- fix(server): use correct bitcoinfaces API and add local caching
- feat(server): add /api/avatars/:seed endpoint to serve cached avatars
- fix(client): add error handling to PaneAvatar component

## Notes
- Existing avatarSvg fields in database may have old external URLs
- New sessions will get local /api/avatars/:seed URLs
- Old URLs will fail gracefully (show initials)
