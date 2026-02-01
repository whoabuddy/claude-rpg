# Phase 1: Upgrade Hash Function - Execution Plan

## Goal

Replace 32-bit DJB2 hash with 64-bit collision-resistant hash to prevent missed terminal updates.

## Problem Analysis

Current implementation in `server-v2/index.ts:81-89`:
```typescript
function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}
```

**Issues:**
- 32-bit output space = ~4.3 billion possible values
- Birthday paradox: ~50% collision probability at √(2^32) ≈ 77,000 items
- Terminal content changes frequently across multiple panes
- Collisions cause missed updates (false negative: different content, same hash)

**Solution:**
- Use Bun's native `Bun.hash()` function (Wyhash algorithm)
- 64-bit output space = 18.4 quintillion possible values
- Collision probability at 1 million items: ~0.0000027%
- Fast: non-cryptographic hash optimized for speed

## Implementation Strategy

### Task 1: Create hash utility module

**File:** `server-v2/lib/hash.ts`

**Implementation:**
```typescript
/**
 * Fast 64-bit hash function for terminal content using Bun's native Wyhash
 *
 * Returns 16-character hex string representing 64-bit hash.
 * Collision probability: ~2.7e-6% at 1M items (vs 50% at 77k for 32-bit)
 */
export function hashContent(content: string): string {
  const hash = Bun.hash(content)
  return hash.toString(16).padStart(16, '0')
}
```

**Rationale:**
- Bun.hash() returns BigInt (64-bit)
- Convert to hex for storage efficiency and readability
- Pad to 16 chars to ensure consistent length (64 bits = 16 hex chars)
- Export same function signature as current implementation for drop-in replacement

### Task 2: Update server to use new hash function

**File:** `server-v2/index.ts`

**Changes:**
1. Remove inline `hashContent()` function (lines 81-89)
2. Add import: `import { hashContent } from './lib/hash'`
3. Clear `terminalHashes` Map on server start (prevent stale hashes from old algorithm)

**Lines to modify:**
- Line 75: Add comment explaining hash cache is cleared on restart
- Line 80-89: Remove old function
- Line 114: No change needed (same function signature)

**Risk mitigation:**
- Hash format change means all content will be considered "new" on first poll after restart
- This is acceptable: one-time full broadcast, then normal diffing resumes
- Alternative considered: migrate old hashes, but complexity not worth one-time cost

### Task 3: Add comprehensive test suite

**File:** `server-v2/__tests__/hash.test.ts`

**Test cases:**

1. **Collision resistance (primary concern)**
   - Generate 100,000 random terminal-like strings
   - Verify no hash collisions
   - Strings include: ANSI codes, Unicode, long lines, common patterns

2. **Determinism**
   - Same input always produces same hash
   - Test with various content: empty, ASCII, Unicode, special chars

3. **Output format**
   - Always returns 16-character hex string
   - Valid hex characters only (0-9, a-f)
   - Consistent padding (no short hashes)

4. **Performance (sanity check)**
   - Hash 10,000 strings of varying length (100-10,000 chars)
   - Should complete in < 100ms on typical hardware
   - Not a strict requirement, just validating Bun.hash is fast

**Test data generation:**
- Real terminal patterns: prompts, spinners, ANSI sequences
- Edge cases: empty, very long (100KB), Unicode heavy, binary-like
- Incremental changes: single char diff, line additions, reordering

## Acceptance Criteria

- [ ] `hashContent()` produces 64-bit output (16 hex chars)
- [ ] No collisions in 100k terminal sample test
- [ ] All tests pass (`bun test server-v2/__tests__/hash.test.ts`)
- [ ] Server starts without errors
- [ ] Terminal updates are detected correctly (manual verification via UI)

## Files Modified

- `server-v2/lib/hash.ts` (new) - Hash utility
- `server-v2/index.ts` - Remove old function, import new one
- `server-v2/__tests__/hash.test.ts` (new) - Comprehensive tests

## Verification Steps

1. Run tests: `bun test server-v2/__tests__/hash.test.ts`
2. Start server: `bun run server-v2/index.ts`
3. Connect client and verify terminal updates appear
4. Monitor terminal hashes in memory (should be 16 hex chars)

## Rollback Plan

If issues arise:
1. Revert commits in reverse order
2. Server will restart with old hash function
3. No data corruption risk (hashes are ephemeral, not persisted)

## Timeline

- Task 1: 15 minutes (create hash module)
- Task 2: 10 minutes (update server)
- Task 3: 25 minutes (write tests)
- Verification: 10 minutes
- Total: ~60 minutes
