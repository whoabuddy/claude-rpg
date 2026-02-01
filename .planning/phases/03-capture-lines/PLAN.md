# Phase 3: Increase Terminal Capture Lines - Execution Plan

**Goal:** Capture enough terminal lines to reliably detect all prompt types

## Analysis

Current state:
- `server-v2/tmux/commands.ts:88` - `capturePane()` defaults to 50 lines
- `server-v2/tmux/poller.ts:227` - Hardcoded to capture 100 lines for Claude panes
- `server-v2/terminal/parser.ts:17` - Parser uses `MAX_LINES = 50` for processing
- `server-v2/lib/config.ts` - No configurable setting for capture lines

Problem: Claude prompts with context/options can span 60+ lines. If the prompt starts above line 100 in the terminal and we only capture 100 lines, we might miss the beginning of the prompt.

Solution: Increase default to 150 lines and make it configurable.

## Files to Modify

1. `server-v2/lib/config.ts` - Add `terminalCaptureLines` configuration
2. `server-v2/tmux/poller.ts` - Use config value instead of hardcoded 100
3. `server-v2/tmux/commands.ts` - Update default parameter documentation
4. `server-v2/__tests__/terminal/parser.test.ts` - Add test for prompts in lines 100-150

## Tasks

### Task 1: Add terminalCaptureLines to config

**Files:** `server-v2/lib/config.ts`

**Action:**
1. Add `terminalCaptureLines` field to `Config` interface
2. Add validation function to ensure value is within 50-500 range
3. Add `getEnvInt()` call with default of 150
4. Export the config value

**Verify:**
```bash
cd /home/whoabuddy/dev/whoabuddy/claude-rpg
bun test server-v2/__tests__/config.test.ts
```

### Task 2: Update poller to use config value

**Files:** `server-v2/tmux/poller.ts`

**Action:**
1. Import `getConfig()` from `../lib/config`
2. Replace hardcoded `100` on line 227 with `getConfig().terminalCaptureLines`
3. Update any comments that reference the 100-line limit

**Verify:**
```bash
cd /home/whoabuddy/dev/whoabuddy/claude-rpg
# Check syntax
bun run server-v2/index.ts --help
# Check that server starts without errors
timeout 5s bun run server-v2/index.ts || true
```

### Task 3: Update capturePane documentation

**Files:** `server-v2/tmux/commands.ts`

**Action:**
1. Update the default parameter value from `50` to `150` on line 88
2. Update JSDoc comment to mention configurable default

**Verify:**
```bash
cd /home/whoabuddy/dev/whoabuddy/claude-rpg
# TypeScript should not show errors
bun build server-v2/tmux/commands.ts --target=bun
```

### Task 4: Add test for deep prompt detection

**Files:** `server-v2/__tests__/terminal/parser.test.ts`

**Action:**
1. Add new test case in a "large terminal capture" describe block
2. Generate terminal content with 120 lines of filler, then a prompt at line 121
3. Verify parser detects the prompt correctly

**Verify:**
```bash
cd /home/whoabuddy/dev/whoabuddy/claude-rpg
bun test server-v2/__tests__/terminal/parser.test.ts
```

## Acceptance Criteria

- [ ] Config has `terminalCaptureLines` field with default 150
- [ ] Poller uses config value instead of hardcoded 100
- [ ] capturePane default updated to 150
- [ ] Test confirms parser detects prompts in lines 100-150
- [ ] All tests pass
- [ ] Server starts without errors

## Risk Assessment

**Low risk:** This change only increases the amount of data captured, which is a safe operation. The parser already processes the content line by line, so performance impact should be minimal.

**Mitigation:** Keep the 500-line upper limit to prevent excessive memory usage.
