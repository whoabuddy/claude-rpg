# Phase 4: Improve Persona Names - Plan

## Problem
Current fantasy names ("Frost Mist", "Radiant Dragon") don't relate to anything meaningful. User wants more relatable names.

## Solution
Replace fantasy ADJECTIVES + NOUNS with human first names. This provides:
1. Maximum relatability - familiar names people recognize
2. Gender diversity - mix of traditionally masculine/feminine/neutral names
3. Cultural variety - names from different origins
4. Easy to remember and pronounce
5. Professional feel while maintaining personality

## Files to Modify
- `server-v2/personas/names.ts` - Replace ADJECTIVES/NOUNS with FIRST_NAMES array

## Tasks

### Task 1: Replace name arrays with human first names
**Action:** Replace ADJECTIVES and NOUNS arrays with a single FIRST_NAMES array containing ~100 diverse human first names

**Changes:**
- Remove ADJECTIVES array (96 entries)
- Remove NOUNS array (96 entries)
- Add FIRST_NAMES array with diverse human names
- Update generateNameFromSessionId() to use single name (not "Adj Noun")
- Update generateUniqueName() to pick single name from FIRST_NAMES
- Update getPossibleNameCount() to return FIRST_NAMES.length

**Verify:**
```bash
cd /home/whoabuddy/dev/whoabuddy/claude-rpg
bun run server-v2/personas/names.ts
# Check that generateUniqueName() returns simple names like "Alice", "Charlie"
```

### Task 2: Test name generation
**Action:** Verify new names appear in UI

**Changes:**
- Restart server
- Check Personas page shows human names instead of fantasy names
- Verify names are still unique per session

**Verify:**
```bash
# Server should generate names like "Maya", "Jordan", "Alex" instead of "Frost Mist"
# Check that existing sessions keep their names (deterministic from session ID)
```

## Expected Outcome
- Personas show relatable human first names
- Names are still deterministic per session ID
- Unique name generation still works
- No "Adjective Noun" combinations

## Rollback Plan
If user dislikes human names, alternatives:
1. Famous scientists (Edison, Tesla, Curie...)
2. Greek gods/mythology (Apollo, Athena, Zeus...)
3. Constellation names (Orion, Vega, Sirius...)
4. Simple adjective + animal (Swift Fox, Calm Bear...)
