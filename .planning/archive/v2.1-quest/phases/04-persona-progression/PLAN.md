# Phase 4: Deepen Persona Progression

## Goal

Add progression tiers, auto-assigned specialization badges, and personality traits to personas.

## Context

**Existing Persona System:**
- `server-v2/personas/types.ts` defines `Persona` with: id, sessionId, name, avatarUrl, status, totalXp, level, createdAt, lastSeenAt
- `server-v2/personas/service.ts` has getOrCreatePersona(), addXp(), calculateLevel()
- Level formula: Each level requires 100 * level XP (Level 1: 0, Level 2: 100, Level 3: 300, etc.)
- Stats tracked in `stats` table with `stat_path` keys: tools_used, files_edited, commits_created, tests_run, etc.
- `server-v2/achievements/checker.ts` has `buildEntityStats()` that aggregates stats from DB

**Database Patterns:**
- Schema in `server-v2/db/schema.ts` (CREATE_TABLES string)
- Migrations in `server-v2/db/migrations.ts` (MIGRATIONS array)
- Prepared statements in `server-v2/db/index.ts` (Queries interface + initQueries())
- SCHEMA_VERSION must be incremented and new migration added

**Frontend:**
- `src/routes/PersonasPage.tsx` displays personas from pane.process.claudeSession
- Data flows: tmux poll -> WebSocket -> Zustand store -> React components
- PersonaCard shows name, avatar, status, current tool, XP, prompts

**Design Decisions:**

1. **Tiers** (based on level):
   - Novice (1-4), Apprentice (5-9), Journeyman (10-14), Expert (15-19), Master (20+)
   - Pure function, no DB storage needed - computed from level

2. **Specialization Badges** (based on tool usage patterns):
   - "Code Architect" - 100+ Edit tool uses
   - "Test Champion" - 50+ test runs
   - "Git Master" - 50+ commits
   - "Shell Sage" - 100+ Bash tool uses
   - "Wordsmith" - 50+ Write tool uses
   - Stored as JSON array in persona row (badges column)

3. **Personality Traits** (unlocked at milestones):
   - Procedurally generated from name + stats at creation
   - Backstory blurb unlocks at level 5
   - Quirk unlocks at level 10
   - Computed from persona attributes, no separate storage

<plan>
  <goal>Add tiers, specialization badges, and personality traits to persona progression</goal>
  <context>
    Personas already have XP and levels. Tiers are computed from level. Badges track specializations
    based on cumulative tool usage. Personality is generated deterministically from persona attributes.
    Requires new persona fields (tier, badges) and new modules for tier/badge/personality logic.
  </context>

  <task id="1">
    <name>Add tier and badge modules with types</name>
    <files>
      server-v2/personas/tiers.ts (new),
      server-v2/personas/badges.ts (new),
      server-v2/personas/personality.ts (new),
      server-v2/personas/types.ts,
      shared/types.ts
    </files>
    <action>
1. Create server-v2/personas/tiers.ts:
   ```typescript
   export type PersonaTier = 'novice' | 'apprentice' | 'journeyman' | 'expert' | 'master'

   export interface TierDefinition {
     name: PersonaTier
     displayName: string
     minLevel: number
     maxLevel: number
     color: string  // Tailwind color class
   }

   export const TIERS: TierDefinition[] = [
     { name: 'novice', displayName: 'Novice', minLevel: 1, maxLevel: 4, color: 'text-gray-400' },
     { name: 'apprentice', displayName: 'Apprentice', minLevel: 5, maxLevel: 9, color: 'text-green-400' },
     { name: 'journeyman', displayName: 'Journeyman', minLevel: 10, maxLevel: 14, color: 'text-blue-400' },
     { name: 'expert', displayName: 'Expert', minLevel: 15, maxLevel: 19, color: 'text-purple-400' },
     { name: 'master', displayName: 'Master', minLevel: 20, maxLevel: Infinity, color: 'text-amber-400' },
   ]

   export function getTierForLevel(level: number): TierDefinition
   export function getNextTier(currentTier: PersonaTier): TierDefinition | null
   ```

2. Create server-v2/personas/badges.ts:
   ```typescript
   export interface BadgeDefinition {
     id: string
     name: string
     description: string
     icon: string
     requirement: { statPath: string; threshold: number }
   }

   export const BADGES: BadgeDefinition[] = [
     { id: 'code_architect', name: 'Code Architect', description: '100+ file edits', icon: '🏗️', requirement: { statPath: 'files_edited', threshold: 100 } },
     { id: 'test_champion', name: 'Test Champion', description: '50+ test runs', icon: '🧪', requirement: { statPath: 'tests_run', threshold: 50 } },
     { id: 'git_master', name: 'Git Master', description: '50+ commits', icon: '🔀', requirement: { statPath: 'commits_created', threshold: 50 } },
     { id: 'shell_sage', name: 'Shell Sage', description: '100+ shell commands', icon: '🐚', requirement: { statPath: 'bash_commands', threshold: 100 } },
     { id: 'wordsmith', name: 'Wordsmith', description: '50+ files written', icon: '✍️', requirement: { statPath: 'files_written', threshold: 50 } },
     { id: 'clarity_coder', name: 'Clarity Coder', description: '10+ Clarity files edited', icon: '📜', requirement: { statPath: 'clarity_files_edited', threshold: 10 } },
   ]

   export function checkBadges(stats: Record<string, number>): string[]  // Returns earned badge IDs
   export function getBadgeDefinition(id: string): BadgeDefinition | undefined
   ```

3. Create server-v2/personas/personality.ts:
   ```typescript
   export interface PersonaPersonality {
     backstory: string | null  // Unlocks at level 5
     quirk: string | null      // Unlocks at level 10
   }

   // Backstory templates keyed by dominant stat
   const BACKSTORIES: Record<string, string[]> = {
     files_edited: ['A meticulous craftsman who...', 'Born to refactor...'],
     tests_run: ['Quality is their middle name...', 'Never ships without proof...'],
     commits_created: ['Commits early, commits often...', 'History is written one commit at a time...'],
     default: ['A wandering coder seeking purpose...', 'Fresh from the digital academy...'],
   }

   // Quirks based on name hash
   const QUIRKS: string[] = [
     'Mutters variable names while thinking',
     'Refuses to use tabs',
     'Always triple-checks before pushing',
     'Has a lucky keyboard',
     'Debugs by talking to a rubber duck',
   ]

   export function generatePersonality(name: string, level: number, stats: Record<string, number>): PersonaPersonality
   ```

4. Update server-v2/personas/types.ts - add to Persona interface:
   ```typescript
   tier: PersonaTier
   badges: string[]  // Badge IDs
   personality: PersonaPersonality
   ```

5. Update shared/types.ts - add PersonaTier, BadgeDefinition, PersonaPersonality types for frontend
    </action>
    <verify>
      bun run server-v2/personas/tiers.ts (type check)
      bun run server-v2/personas/badges.ts (type check)
      bun run server-v2/personas/personality.ts (type check)
    </verify>
    <done>Tier, badge, and personality modules exist with type definitions exported to shared/types.ts</done>
  </task>

  <task id="2">
    <name>Add badges column and update persona service</name>
    <files>
      server-v2/db/schema.ts,
      server-v2/db/migrations.ts,
      server-v2/db/index.ts,
      server-v2/personas/service.ts,
      server-v2/personas/index.ts
    </files>
    <action>
1. Update server-v2/db/schema.ts:
   - Increment SCHEMA_VERSION to 3
   - Add badges column to personas table in CREATE_TABLES:
     `badges TEXT DEFAULT '[]'`  (JSON array of badge IDs)

2. Add migration in server-v2/db/migrations.ts:
   ```typescript
   {
     version: 3,
     name: 'add_persona_badges',
     sql: `ALTER TABLE personas ADD COLUMN badges TEXT DEFAULT '[]';`,
   }
   ```

3. Update server-v2/db/index.ts:
   - Add to Queries interface: updatePersonaBadges: Statement
   - Add prepared statement in initQueries():
     `updatePersonaBadges: db.prepare('UPDATE personas SET badges = ? WHERE id = ?')`

4. Update server-v2/personas/service.ts:
   - Import getTierForLevel from './tiers'
   - Import checkBadges from './badges'
   - Import generatePersonality from './personality'
   - Update mapDbToPersona() to include tier, badges, personality:
     ```typescript
     function mapDbToPersona(row: Record<string, unknown>): Persona {
       const level = row.level as number
       const badges = JSON.parse((row.badges as string) || '[]')
       return {
         ...existing fields...,
         tier: getTierForLevel(level).name,
         badges,
         personality: generatePersonality(row.name as string, level, {}), // stats loaded separately
       }
     }
     ```
   - Add updateBadges(personaId: string, badges: string[]) function
   - In addXp(): after level up, check and update badges:
     ```typescript
     // After updating level
     const stats = getPersonaStats(personaId)  // Load from stats table
     const earnedBadges = checkBadges(stats)
     const currentBadges = persona.badges || []
     const newBadges = earnedBadges.filter(b => !currentBadges.includes(b))
     if (newBadges.length > 0) {
       updateBadges(personaId, [...currentBadges, ...newBadges])
       log.info('Persona earned badges', { personaId, newBadges })
     }
     ```
   - Add getPersonaStats(personaId: string) helper to load stats from DB

5. Update server-v2/personas/index.ts to export new functions and types
    </action>
    <verify>
      bun run server-v2/index.ts (server starts, migration runs)
      Check database: sqlite3 ~/.local/share/claude-rpg/claude-rpg-v2.db ".schema personas" (badges column exists)
    </verify>
    <done>Badges column added, service computes tier/badges/personality on persona fetch</done>
  </task>

  <task id="3">
    <name>Update PersonasPage UI with tiers, badges, and personality</name>
    <files>
      src/routes/PersonasPage.tsx,
      src/components/PersonaBadges.tsx (new),
      src/components/TierBadge.tsx (new)
    </files>
    <action>
1. Create src/components/TierBadge.tsx:
   ```typescript
   interface TierBadgeProps {
     tier: PersonaTier
     size?: 'sm' | 'md'
   }

   // Map tier to display name and color
   const TIER_STYLES: Record<PersonaTier, { label: string; className: string }> = {
     novice: { label: 'Novice', className: 'bg-gray-700 text-gray-300' },
     apprentice: { label: 'Apprentice', className: 'bg-green-900 text-green-300' },
     journeyman: { label: 'Journeyman', className: 'bg-blue-900 text-blue-300' },
     expert: { label: 'Expert', className: 'bg-purple-900 text-purple-300' },
     master: { label: 'Master', className: 'bg-amber-900 text-amber-300' },
   }

   export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
     const style = TIER_STYLES[tier]
     return <span className={`px-2 py-0.5 rounded text-xs ${style.className}`}>{style.label}</span>
   }
   ```

2. Create src/components/PersonaBadges.tsx:
   ```typescript
   interface PersonaBadgesProps {
     badges: string[]
     max?: number  // Max to show before "+N more"
   }

   // Badge definitions (duplicate from server for display)
   const BADGE_INFO: Record<string, { icon: string; name: string }> = {
     code_architect: { icon: '🏗️', name: 'Code Architect' },
     test_champion: { icon: '🧪', name: 'Test Champion' },
     git_master: { icon: '🔀', name: 'Git Master' },
     shell_sage: { icon: '🐚', name: 'Shell Sage' },
     wordsmith: { icon: '✍️', name: 'Wordsmith' },
     clarity_coder: { icon: '📜', name: 'Clarity Coder' },
   }

   export function PersonaBadges({ badges, max = 3 }: PersonaBadgesProps) {
     // Render badges with tooltips, show "+N" if more than max
   }
   ```

3. Update src/routes/PersonasPage.tsx PersonaCard component:
   - Add TierBadge next to persona name
   - Add PersonaBadges below stats row
   - Add personality section (collapsed by default, expandable):
     - Show backstory if level >= 5
     - Show quirk if level >= 10
     - Use subtle text color (rpg-text-dim)

   Layout changes to PersonaCard:
   ```tsx
   <div className="flex items-center gap-2">
     <span className="font-medium">{session.name}</span>
     <TierBadge tier={session.tier || 'novice'} />
     <StatusPill status={session.status} size="sm" />
   </div>

   {/* Badges row */}
   {session.badges?.length > 0 && (
     <PersonaBadges badges={session.badges} />
   )}

   {/* Personality (expandable) */}
   {(session.personality?.backstory || session.personality?.quirk) && (
     <details className="mt-2 text-xs text-rpg-text-dim">
       <summary className="cursor-pointer">Personality</summary>
       {session.personality.backstory && <p className="mt-1">{session.personality.backstory}</p>}
       {session.personality.quirk && <p className="mt-1 italic">"{session.personality.quirk}"</p>}
     </details>
   )}
   ```

4. Update shared/types.ts ClaudeSessionInfo to include tier, badges, personality (if not already)
    </action>
    <verify>
      npm run build (no TypeScript errors)
      Open http://localhost:4011/personas - personas show tier badge, specialization badges, and personality details
    </verify>
    <done>PersonasPage displays tier badges, specialization badges, and expandable personality for each persona</done>
  </task>
</plan>

## Issue

Addresses #151 (partial - tiers, badges, traits)

## Commit Format

```
feat(personas): add progression tiers, badges, and personality

- Add tier system computed from level (Novice -> Master)
- Add specialization badges based on tool usage patterns
- Add procedurally generated personality traits
- Update PersonasPage with tier/badge display

Addresses #151
```
