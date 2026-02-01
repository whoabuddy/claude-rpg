# Phase 5: Add Persona Health and Challenges

## Goal

Add health/morale meters and daily/weekly personal challenges for personas to enhance the "living character" feel and provide meaningful goals tied to activity.

## Context

**Existing Persona System:**
- `server-v2/personas/types.ts` defines `Persona` with: id, sessionId, name, avatarUrl, status, totalXp, level, createdAt, lastSeenAt
- `server-v2/personas/service.ts` has: getOrCreatePersona, updateLastSeen, updateStatus, addXp, calculateLevel
- Database table `personas` in `server-v2/db/schema.ts` with prepared statements in `server-v2/db/index.ts`
- PersonasPage displays persona cards with avatar, status, current tool, project, and basic stats

**Event System:**
- `server-v2/events/bus.ts` provides typed event bus with subscribe/emit pattern
- `server-v2/events/hooks.ts` processes Claude Code hook events: pre_tool_use, post_tool_use, stop, user_prompt
- Events flow: hook -> eventBus.emit() -> handlers -> state updates -> WebSocket broadcast

**Health/Morale Design (from issue #151):**
- Energy: drains on idle/errors, fills on prompts/successes
- Morale: boosts on successes (tests pass, commits), drops on repeated errors
- Low states affect visual display (tired avatar, warning indicators)
- Natural way to show "fading out" from memory and help with fatigue tracking

**Challenge System Design:**
- Daily challenges: achievable in one session (e.g., "Run 3 tests", "Make 2 commits")
- Weekly challenges: larger goals (e.g., "Complete a quest phase", "Earn 500 XP")
- Auto-assign based on persona activity patterns
- Bonus XP on completion
- Progress tracked per persona

**Database Migration Pattern:**
- Add new columns/tables in `server-v2/db/migrations.ts`
- Increment SCHEMA_VERSION in `server-v2/db/schema.ts`
- Add prepared statements to Queries interface in `server-v2/db/index.ts`

<plan>
  <goal>Add health/morale system and daily/weekly challenges for personas</goal>
  <context>
    Build on existing persona system with event-driven updates.
    Health/morale provide visual feedback on session activity.
    Challenges add meaningful micro-goals with XP rewards.
  </context>

  <task id="1">
    <name>Add health/morale system with event-driven updates</name>
    <files>
      server-v2/personas/types.ts,
      server-v2/personas/health.ts (new),
      server-v2/personas/service.ts,
      server-v2/db/schema.ts,
      server-v2/db/migrations.ts,
      server-v2/db/index.ts
    </files>
    <action>
1. **Update types.ts** - Add health/morale to Persona interface:
   ```typescript
   export interface PersonaHealth {
     energy: number      // 0-100, drains on idle, fills on activity
     morale: number      // 0-100, boosts on success, drops on errors
     lastUpdated: string // ISO timestamp
   }

   // Add to Persona interface:
   health: PersonaHealth
   ```

2. **Create health.ts** - Health calculation logic:
   ```typescript
   // Constants
   const MAX_HEALTH = 100
   const ENERGY_DECAY_PER_MINUTE = 0.5  // Idle decay
   const ENERGY_GAIN_PROMPT = 10        // User sent prompt
   const ENERGY_GAIN_TOOL_USE = 2       // Tool completed
   const MORALE_GAIN_SUCCESS = 5        // Successful tool
   const MORALE_LOSS_ERROR = 10         // Failed tool
   const MORALE_GAIN_TEST_PASS = 15     // Test run completed
   const MORALE_GAIN_COMMIT = 20        // Git commit

   // Functions:
   calculateEnergyDecay(lastUpdated: string): number
   applyEnergyGain(current: number, amount: number): number
   applyMoraleDelta(current: number, delta: number): number
   getHealthLevel(value: number): 'critical' | 'low' | 'normal' | 'high'
   ```

3. **Add database migration** - Add health columns to personas:
   ```sql
   ALTER TABLE personas ADD COLUMN energy INTEGER DEFAULT 100;
   ALTER TABLE personas ADD COLUMN morale INTEGER DEFAULT 100;
   ALTER TABLE personas ADD COLUMN health_updated_at TEXT;
   ```
   - Increment SCHEMA_VERSION to 3 in schema.ts
   - Add migration version 3 in migrations.ts

4. **Add prepared statements** to db/index.ts Queries interface:
   - updatePersonaHealth: UPDATE personas SET energy = ?, morale = ?, health_updated_at = ? WHERE id = ?
   - getPersonaHealth: SELECT energy, morale, health_updated_at FROM personas WHERE id = ?

5. **Update service.ts** - Add health management functions:
   ```typescript
   export function updateHealth(personaId: string, energyDelta: number, moraleDelta: number): PersonaHealth
   export function getHealth(personaId: string): PersonaHealth
   export function decayHealth(personaId: string): PersonaHealth // Called on poll
   ```

6. **Register event handlers** - In service.ts or new init function:
   - On 'hook:user_prompt': energy +10
   - On 'hook:post_tool_use' (success): energy +2, morale +5
   - On 'hook:post_tool_use' (failure): morale -10
   - On 'hook:post_tool_use' (Bash with test/commit): morale bonus
    </action>
    <verify>
1. Server starts without errors: `bun run server-v2/index.ts`
2. Check migration applied: `sqlite3 ~/.local/share/claude-rpg/claude-rpg-v2.db ".schema personas"`
3. Verify columns exist: should show energy, morale, health_updated_at
    </verify>
    <done>
- PersonaHealth interface defined with energy/morale fields
- Database has health columns with defaults
- Health update functions work and respond to events
- Health values persist across server restarts
    </done>
  </task>

  <task id="2">
    <name>Add challenge system with assignment and tracking</name>
    <files>
      server-v2/personas/challenges.ts (new),
      server-v2/personas/types.ts,
      server-v2/personas/service.ts,
      server-v2/db/schema.ts,
      server-v2/db/migrations.ts,
      server-v2/db/index.ts,
      server-v2/api/handlers.ts,
      server-v2/api/routes.ts
    </files>
    <action>
1. **Add types** to types.ts:
   ```typescript
   export type ChallengePeriod = 'daily' | 'weekly'
   export type ChallengeStatus = 'active' | 'completed' | 'expired'

   export interface ChallengeDefinition {
     id: string
     name: string
     description: string
     period: ChallengePeriod
     target: number           // e.g., 3 for "Run 3 tests"
     stat: string             // stat path to check: 'commands.testsRun', 'git.commits'
     xpReward: number
   }

   export interface PersonaChallenge {
     id: string
     personaId: string
     challengeId: string
     period: ChallengePeriod
     status: ChallengeStatus
     progress: number
     target: number
     xpReward: number
     assignedAt: string
     expiresAt: string        // End of day/week
     completedAt?: string
   }
   ```

2. **Create challenges.ts** - Challenge definitions and logic:
   ```typescript
   // Daily challenges (pick 2-3 randomly per persona)
   export const DAILY_CHALLENGES: ChallengeDefinition[] = [
     { id: 'run-tests', name: 'Test Runner', description: 'Run 3 tests', period: 'daily', target: 3, stat: 'commands.testsRun', xpReward: 25 },
     { id: 'make-commits', name: 'Commit Streak', description: 'Make 2 commits', period: 'daily', target: 2, stat: 'git.commits', xpReward: 30 },
     { id: 'use-tools', name: 'Tool Master', description: 'Use 10 tools', period: 'daily', target: 10, stat: 'toolsUsed', xpReward: 20 },
     { id: 'receive-prompts', name: 'Active Session', description: 'Receive 5 prompts', period: 'daily', target: 5, stat: 'promptsReceived', xpReward: 15 },
   ]

   // Weekly challenges
   export const WEEKLY_CHALLENGES: ChallengeDefinition[] = [
     { id: 'complete-phase', name: 'Quest Progress', description: 'Complete a quest phase', period: 'weekly', target: 1, stat: 'quests.phasesCompleted', xpReward: 100 },
     { id: 'earn-xp', name: 'XP Hunter', description: 'Earn 500 XP', period: 'weekly', target: 500, stat: 'totalXp', xpReward: 75 },
     { id: 'run-many-tests', name: 'Quality Champion', description: 'Run 20 tests', period: 'weekly', target: 20, stat: 'commands.testsRun', xpReward: 80 },
   ]

   // Functions:
   assignDailyChallenges(personaId: string): PersonaChallenge[]
   assignWeeklyChallenges(personaId: string): PersonaChallenge[]
   updateChallengeProgress(personaId: string, stat: string, delta: number): PersonaChallenge | null
   checkChallengeCompletion(challenge: PersonaChallenge): boolean
   getActiveChallenges(personaId: string): PersonaChallenge[]
   expireOldChallenges(): void  // Called periodically
   ```

3. **Add database table** for persona_challenges:
   ```sql
   CREATE TABLE IF NOT EXISTS persona_challenges (
     id TEXT PRIMARY KEY,
     persona_id TEXT NOT NULL REFERENCES personas(id),
     challenge_id TEXT NOT NULL,
     period TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'active',
     progress INTEGER DEFAULT 0,
     target INTEGER NOT NULL,
     xp_reward INTEGER NOT NULL,
     assigned_at TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     completed_at TEXT
   );
   CREATE INDEX IF NOT EXISTS idx_challenges_persona ON persona_challenges(persona_id);
   CREATE INDEX IF NOT EXISTS idx_challenges_status ON persona_challenges(status);
   ```
   - Add to migration version 3 (same migration as health)

4. **Add prepared statements** to db/index.ts:
   - insertChallenge, getChallengeById, getActiveChallengesByPersona
   - updateChallengeProgress, completeChallenge, expireChallenges

5. **Add API endpoint** for challenges:
   - GET /api/personas/:id/challenges -> list active/completed challenges
   - Add to routes.ts and handlers.ts

6. **Hook into event system** - Update challenge progress:
   - On 'hook:post_tool_use': increment relevant stat
   - On test/commit detected: update specific challenge
   - On completion: award XP via addXp()
    </action>
    <verify>
1. Server starts: `bun run server-v2/index.ts`
2. Check table: `sqlite3 ~/.local/share/claude-rpg/claude-rpg-v2.db ".schema persona_challenges"`
3. Test endpoint: `curl http://localhost:4011/api/personas/{id}/challenges`
    </verify>
    <done>
- Challenge definitions exist for daily and weekly goals
- Challenges auto-assign to personas on session activity
- Progress updates via event hooks
- Completed challenges award bonus XP
- API endpoint returns active challenges
    </done>
  </task>

  <task id="3">
    <name>Update PersonasPage with health bars and challenge cards</name>
    <files>
      src/routes/PersonasPage.tsx,
      src/components/HealthMeter.tsx (new),
      src/components/ChallengeCard.tsx (new),
      shared/types.ts,
      src/store/index.ts
    </files>
    <action>
1. **Update shared/types.ts** - Add health and challenge types for client:
   ```typescript
   export interface PersonaHealth {
     energy: number
     morale: number
     lastUpdated: string
   }

   export interface PersonaChallenge {
     id: string
     name: string
     description: string
     period: 'daily' | 'weekly'
     status: 'active' | 'completed' | 'expired'
     progress: number
     target: number
     xpReward: number
     expiresAt: string
   }
   ```

2. **Create HealthMeter.tsx** - Visual health bars:
   ```typescript
   interface HealthMeterProps {
     label: string           // "Energy" or "Morale"
     value: number           // 0-100
     color: 'green' | 'blue' | 'yellow' | 'red'
     size?: 'sm' | 'md'
   }
   ```
   - Horizontal bar with percentage fill
   - Color changes based on level (>70 green, >40 yellow, <=40 red)
   - Subtle animation on low values
   - Tooltip showing exact value

3. **Create ChallengeCard.tsx** - Challenge display:
   ```typescript
   interface ChallengeCardProps {
     challenge: PersonaChallenge
     compact?: boolean
   }
   ```
   - Show name, description, progress/target
   - Progress bar
   - XP reward badge
   - "Daily" or "Weekly" pill
   - Completed state with checkmark
   - Time remaining indicator

4. **Update PersonasPage.tsx** - Integrate new components:
   - Add health meters below avatar in PersonaCard
   - Add challenges section (collapsible) showing active challenges
   - Fetch challenges via /api/personas/:id/challenges
   - Show completion celebration toast when challenge completes
   - Add filter option: "Low Energy" to surface personas needing attention

5. **Update store** if needed:
   - Add persona health to WebSocket updates
   - Add challenge state slice if polling challenges
    </action>
    <verify>
1. Build client: `bun run scripts/build-client.ts`
2. Navigate to /personas in browser
3. Verify health meters appear on persona cards
4. Verify challenges section shows active challenges
5. Check responsive layout on mobile viewport
    </verify>
    <done>
- HealthMeter component displays energy/morale with color coding
- ChallengeCard shows challenge progress and rewards
- PersonasPage shows health and challenges for each persona
- Low health personas are visually distinct
- Challenge completion triggers celebration feedback
    </done>
  </task>
</plan>

## Issue

Addresses #151 (partial - health/morale, challenges)

## Commit Format

```
feat(personas): add health/morale system and challenges

- Add energy and morale meters that respond to activity
- Add daily/weekly challenge definitions with XP rewards
- Create HealthMeter and ChallengeCard UI components
- Update PersonasPage with health bars and active challenges

Addresses #151
```

## Dependencies

Phase 4 (persona progression system) - for tier/badge context, though health/challenges can work independently.

## Notes

- Health decay runs on tmux poll cycle (every 250ms is too frequent; decay calculated on-demand based on lastUpdated)
- Challenges assigned lazily on first activity of day/week
- Weekly challenges reset on Monday 00:00 local time
- Consider WebSocket message for challenge completion to enable celebration overlay
