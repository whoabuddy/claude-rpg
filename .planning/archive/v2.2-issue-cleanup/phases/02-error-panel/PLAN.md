# PLAN: Phase 2 - Fix Error Panel Sensitivity

<plan>
  <goal>
    Fix error panel persistence so it clears after successful actions or a reasonable timeout, not remaining indefinitely after a single failed tool use.
  </goal>

  <context>
    Current behavior (broken):
    - Tool fails -> lastError set -> error panel shows (correct)
    - User retries -> tool succeeds -> error panel still shows (wrong)
    - Error persists until page refresh or status change

    Expected behavior:
    - Tool fails -> error panel shows
    - Tool succeeds -> error clears automatically
    - If no activity for 5s after error, panel fades/clears
    - Status transition to working/idle clears error

    The error state is tracked in ClaudeSessionInfo.lastError in shared/types.ts.
    It's set in event handlers when tool fails.
    Need to also clear it on success.

    Files to read:
    - server-v2/events/handlers.ts (where lastError is set)
    - server-v2/sessions/manager.ts (session state updates)
    - src/components/PaneCard.tsx (where error is displayed)
    - shared/types.ts (SessionError interface)
  </context>

  <task id="1">
    <name>Clear lastError on successful tool use</name>
    <files>server-v2/events/handlers.ts, server-v2/sessions/manager.ts</files>
    <action>
      1. In events/handlers.ts, find where lastError is set (post_tool_use handler)
      2. Add logic: if event.success === true, clear lastError on the session
      3. In sessions/manager.ts, add function clearError(paneId: string):
         ```typescript
         export function clearError(paneId: string): void {
           const session = sessions.get(paneId)
           if (session) {
             session.lastError = undefined
             // ... trigger broadcast
           }
         }
         ```
      4. Call clearError when:
         - Tool succeeds (success !== false)
         - Session transitions to 'idle' (stop event)
         - User submits new prompt (user_prompt_submit)
    </action>
    <verify>
      1. Trigger an error (e.g., ask Claude to read a non-existent file)
      2. Observe error panel appears
      3. Ask Claude to read a file that exists
      4. Observe error panel clears immediately
    </verify>
    <done>Successful tool use clears error state</done>
  </task>

  <task id="2">
    <name>Add timeout-based error fade in frontend</name>
    <files>src/components/PaneCard.tsx, src/components/StatusIndicator.tsx</files>
    <action>
      1. In PaneCard.tsx, track error display state with timestamp:
         ```typescript
         const [visibleError, setVisibleError] = useState<SessionError | null>(null)

         useEffect(() => {
           if (lastError) {
             setVisibleError(lastError)
           }
           // Clear visible error 5s after last activity
           const timeout = setTimeout(() => {
             if (lastError && Date.now() - lastError.timestamp > 5000) {
               setVisibleError(null)
             }
           }, 5000)
           return () => clearTimeout(timeout)
         }, [lastError, lastActivity])
         ```

      2. Add fade-out animation class to error panel:
         ```css
         .error-fade-out {
           animation: fadeOut 0.5s ease-out forwards;
         }
         ```

      3. Show error with fade animation when clearing:
         - If visibleError but no lastError -> fade out
         - If new lastError -> show immediately
    </action>
    <verify>
      1. Trigger an error in Claude
      2. Error panel shows
      3. Wait 5+ seconds without activity
      4. Error panel fades out smoothly
      5. New activity resets the timer
    </verify>
    <done>Error panel fades after 5s of inactivity</done>
  </task>

  <task id="3">
    <name>Improve error panel UX</name>
    <files>src/components/PaneCard.tsx</files>
    <action>
      1. Add dismiss button (X) to error panel for manual clearing
      2. Show relative timestamp ("5s ago", "1m ago")
      3. Truncate long error messages with expand option
      4. Style: make error panel less alarming (softer red, smaller)

      Implementation:
      ```tsx
      {visibleError && (
        <div className="relative px-2 py-1 bg-rpg-error/10 border border-rpg-error/30 rounded text-xs">
          <button
            onClick={() => setVisibleError(null)}
            className="absolute top-1 right-1 text-rpg-error/50 hover:text-rpg-error"
          >
            <X className="w-3 h-3" />
          </button>
          <span className="text-rpg-error/80">
            {visibleError.tool}: {truncate(visibleError.message, 80)}
          </span>
          <span className="text-rpg-text-dim ml-2">
            {formatRelativeTime(visibleError.timestamp)}
          </span>
        </div>
      )}
      ```
    </action>
    <verify>
      1. Trigger an error
      2. Verify dismiss button works
      3. Verify timestamp shows and updates
      4. Verify long messages truncate gracefully
      5. Verify visual style is less alarming
    </verify>
    <done>Error panel has better UX with dismiss, timestamps, and softer styling</done>
  </task>
</plan>

## Files Summary

**Read first:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/shared/types.ts`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/events/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/sessions/manager.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/styles/main.css` (animation)

## Commits

1. `fix(sessions): clear error state on successful tool use`
2. `feat(ui): add timeout-based error fade and dismiss button`
