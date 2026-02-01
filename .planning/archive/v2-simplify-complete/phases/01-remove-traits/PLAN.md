# Phase 1: Remove Personality Traits System

## Research Summary

The personality system generates backstories and quirks for personas:
- `server-v2/personas/personality.ts` - 61-trait generation (18 backstories + 15 quirks)
- Backstory appears at level 5, quirk at level 10
- Generated deterministically from name + stats

## Files to Modify

### DELETE
1. `server-v2/personas/personality.ts` - Entire file

### MODIFY
2. `shared/types.ts`
   - Remove `PersonaPersonality` interface (lines 560-563)
   - Remove `personality?: PersonaPersonality` from `ClaudeSessionInfo` (line 153)

3. `server-v2/personas/types.ts`
   - Remove `PersonaPersonality` interface (lines 9-12)
   - Remove `personality: PersonaPersonality` from `Persona` interface (line 30)

4. `server-v2/tmux/types.ts`
   - Remove `PersonaPersonality` interface (lines 26-29)
   - Remove `personality: PersonaPersonality` from `ClaudeSessionInfo` (line 50)

5. `server-v2/personas/index.ts`
   - Remove `export { generatePersonality } from './personality'` (line 11)

6. `server-v2/personas/service.ts`
   - Remove import of `generatePersonality` (line 11)
   - Remove `personality: { backstory: null, quirk: null }` from getOrCreatePersona (line 89)
   - Remove `const personality = generatePersonality(name, level, stats)` from mapDbToPersona (line 317)
   - Remove `personality,` from return object in mapDbToPersona (line 332)

7. `server-v2/tmux/session-builder.ts`
   - Remove `personality: persona.personality` from buildSessionInfo (line 27)
   - Remove `personality: persona.personality` from updateClaudeSessionInfo (line 115)

### KEEP (not personality-related)
- `src/components/PersonaBadges.tsx` - Only displays badges (specialization), not personality

## Execution Order

1. Delete `personality.ts` file
2. Update `server-v2/personas/index.ts` - remove export
3. Update `server-v2/personas/service.ts` - remove import and usage
4. Update `server-v2/personas/types.ts` - remove type and interface field
5. Update `server-v2/tmux/types.ts` - remove type and interface field
6. Update `server-v2/tmux/session-builder.ts` - remove personality references
7. Update `shared/types.ts` - remove type and interface field

## Acceptance Criteria

- `grep -r "backstory\|quirk" src/ server-v2/` returns no results
- `grep -r "PersonaPersonality" .` returns no results (except git history)
- Server starts: `bun run server-v2/index.ts`
- Client builds: `bun run scripts/build-client.ts`
