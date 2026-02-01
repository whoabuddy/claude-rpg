# Phase 3: Personas and Projects

## Goal
Implement persona (Claude sessions) and project (git repos) modules.

## Context
- Personas are "floating employees" - session IDs may reuse, many-to-many with projects
- Projects are git repos detected from pane working directory
- Issues: #119, #120

<plan>
  <goal>Create persona and project services with database persistence</goal>
  <context>
    - Bitcoin faces from bitcoinfaces.xyz for avatars
    - Name generation with 200+ unique names
    - Git detection via .git directory
    - GitHub URL from git remote
    - Session ID behavior: generated at launch, may reuse in same directory
  </context>

  <task id="1">
    <name>Implement persona service with name generation and avatars</name>
    <files>server-v2/personas/index.ts, server-v2/personas/service.ts, server-v2/personas/names.ts, server-v2/personas/avatar.ts, server-v2/personas/types.ts</files>
    <action>
      1. Create personas/types.ts:
         - Persona interface matching DB schema
         - PersonaStatus: 'active' | 'idle' | 'offline'
      2. Create personas/names.ts:
         - ADJECTIVES array (100+ words: Crimson, Azure, Silent, Swift, etc.)
         - NOUNS array (100+ words: Mist, Shadow, Phoenix, Wolf, etc.)
         - generateName(existingNames): string
         - Deterministic option based on session_id hash
      3. Create personas/avatar.ts:
         - fetchBitcoinFace(sessionId): Promise<string | null>
         - Retry logic for transient failures
         - Return null on permanent failure
      4. Create personas/service.ts:
         - getOrCreatePersona(sessionId, existingNames): Promise<Persona>
         - updateLastSeen(personaId): Promise<void>
         - getActivePersonas(): Promise<Persona[]>
         - Persist to SQLite via db/queries
      5. Create personas/index.ts:
         - Export service and types
         - Subscribe to pane:discovered event
         - Create/update personas when Claude detected
    </action>
    <verify>
      Call getOrCreatePersona with new session ID, verify persona created
      Call again with same ID, verify same persona returned
      Verify avatar fetched (or null if service down)
    </verify>
    <done>Personas created with unique names and avatars, persisted to DB</done>
  </task>

  <task id="2">
    <name>Implement project service with git detection</name>
    <files>server-v2/projects/index.ts, server-v2/projects/service.ts, server-v2/projects/git.ts, server-v2/projects/types.ts</files>
    <action>
      1. Create projects/types.ts:
         - Project interface matching DB schema
         - ProjectClass: 'frontend' | 'backend' | 'infra' | 'blockchain' | 'fullstack'
      2. Create projects/git.ts:
         - isGitRepo(path): Promise<boolean>
         - getRepoInfo(path): Promise<{name, branch, remote, dirty, ahead, behind}>
         - Use Bun.spawn() for git commands
         - Cache results for 5 seconds
      3. Create projects/service.ts:
         - getOrCreateProject(path): Promise<Project | null>
         - Returns null if not a git repo
         - updateLastActivity(projectId): Promise<void>
         - getActiveProjects(): Promise<Project[]>
         - classifyProject(projectId): ProjectClass (based on XP distribution)
      4. Create projects/index.ts:
         - Export service and types
         - Subscribe to pane:discovered event
         - Create/update projects when git repo detected
    </action>
    <verify>
      Call getOrCreateProject with git repo path, verify project created
      Call with non-git path, verify null returned
      Verify GitHub URL extracted from remote
    </verify>
    <done>Projects detected from git repos, persisted to DB with GitHub links</done>
  </task>
</plan>

## Verification Criteria
- [ ] Personas get unique names (no duplicates among active)
- [ ] Same session_id returns same persona
- [ ] Avatar fetched from bitcoinfaces.xyz
- [ ] Projects detected from git repos
- [ ] GitHub URL extracted when available
- [ ] Both persist to SQLite correctly
