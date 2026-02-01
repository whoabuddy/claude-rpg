# Phase 2: Add GitHub Repo Clone Endpoint

## Goal

Accept a GitHub URL and clone the repo to ~/dev/org/repo/ structure automatically.

## Context

**Existing Infrastructure:**
- `server-v2/projects/git.ts` has git utilities: `isGitRepo`, `getRepoInfo`, `extractGitHubUrl`
- `server-v2/projects/service.ts` has `getOrCreateProject` for registering repos
- Uses Bun.spawn for git commands
- User's dev directory follows `~/dev/org/repo/` structure

**URL Formats to Support:**
- `https://github.com/org/repo`
- `https://github.com/org/repo.git`
- `git@github.com:org/repo.git`
- `github.com/org/repo` (partial URL)

**Edge Cases:**
- Repo already exists locally → return existing path
- Private repo → use `gh repo clone` (uses GitHub auth)
- Invalid URL → return error
- Network error → return error

<plan>
  <goal>Add /api/clone endpoint to clone GitHub repos to ~/dev/org/repo/ structure</goal>
  <context>Leverage existing git.ts for URL parsing, use Bun.spawn for clone, register with project service</context>

  <task id="1">
    <name>Create clone utility module</name>
    <files>server-v2/projects/clone.ts</files>
    <action>
1. Create server-v2/projects/clone.ts with:
   - parseGitHubUrl(url: string) → { org: string, repo: string } | null
     - Handle HTTPS, SSH, and partial URL formats
     - Strip .git suffix if present

   - getTargetPath(org: string, repo: string) → string
     - Return ~/dev/org/repo/ path
     - Use os.homedir() for ~ expansion

   - cloneRepo(url: string) → Promise<CloneResult>
     - Parse URL to get org/repo
     - Check if target path already exists (return early if so)
     - Use `gh repo clone org/repo target_path` (handles auth automatically)
     - Return { success, path, alreadyExists?, error? }

   - Export CloneResult type

2. Use Bun.spawn for the gh clone command with timeout (60 seconds)
    </action>
    <verify>Import and call parseGitHubUrl with various URL formats</verify>
    <done>clone.ts exports parseGitHubUrl, getTargetPath, and cloneRepo functions</done>
  </task>

  <task id="2">
    <name>Add /api/clone endpoint</name>
    <files>server-v2/api/routes.ts, server-v2/api/handlers.ts, server-v2/api/types.ts</files>
    <action>
1. Add route to server-v2/api/routes.ts:
   { method: 'POST', pattern: '/api/clone', handler: 'cloneRepo' }

2. Add CloneRequest type to server-v2/api/types.ts:
   { url: string }

3. Add handler to server-v2/api/handlers.ts:
   - Import { cloneRepo } from '../projects/clone'
   - export async function cloneRepo(body: CloneRequest): Promise<ApiResponse<CloneResult>>
   - Validate URL is provided
   - Call cloneRepo(body.url)
   - On success, optionally call getOrCreateProject to register it
   - Return result with path or error

4. Handle errors gracefully:
   - Invalid URL format
   - Clone failed (network, auth, etc.)
   - Timeout
    </action>
    <verify>curl -X POST http://localhost:4011/api/clone -H "Content-Type: application/json" -d '{"url":"https://github.com/whoabuddy/test-repo"}'</verify>
    <done>POST /api/clone accepts { url } and returns { success, data: { path, alreadyExists } } or error</done>
  </task>
</plan>

## Issue

Closes #154

## Commit Format

```
feat(clone): add /api/clone endpoint for GitHub repo cloning

- Add clone.ts utility with URL parsing and gh clone integration
- Add POST /api/clone endpoint
- Auto-register cloned repos with project service

Closes #154
```
