# Phase 1: Fix Avatar Loading

## Root Causes

1. **Bitcoin Faces API URL format is wrong**: Code uses `/api/get-image/{seed}` but API requires `/api/get-image?name={seed}`
2. **Server hasn't been restarted**: Running server (PID 2010685) started before avatar directory creation code was added

## Tasks

### Task 1: Fix Bitcoin Faces API URL
**File**: `server-v2/personas/avatar.ts`
**Action**: Change line 59 from path parameter to query parameter format
**Verify**: `curl -s "http://localhost:4011/api/avatars/2144932615" | head -5` should return SVG

### Task 2: Restart production server
**Action**: Restart systemd service to create avatars directory and fetch avatars
**Verify**:
- Directory exists: `ls ~/.local/share/claude-rpg/avatars/`
- Avatars are fetched and cached
- Client shows Bitcoin Face avatars, not initials

## Files Changed
- `server-v2/personas/avatar.ts`

## Verification Steps
1. Server logs show "Created avatars directory"
2. Avatar endpoint returns SVG (not 404 HTML)
3. Avatars directory contains `.svg` files
4. Client UI shows Bitcoin Face avatars
