# Phase 5: Terminal and Sessions

## Goal
Implement terminal parsing and session state machine with reconciler.

## Context
- Terminal parsing detects Claude prompts from terminal content
- Session state machine: idle, typing, working, waiting, error
- Reconciler cross-checks hook state vs terminal state
- Issues: #123, #124

<plan>
  <goal>Create terminal parser and session state reconciler</goal>
  <context>
    - Reference existing server/terminal-parser.ts for patterns
    - Patterns will need regular updates with Claude Code releases
    - Confidence scoring helps handle ambiguous states
    - Manual state machine with explicit transitions
  </context>

  <task id="1">
    <name>Implement terminal parsing with pattern registry</name>
    <files>server-v2/terminal/index.ts, server-v2/terminal/parser.ts, server-v2/terminal/patterns.ts, server-v2/terminal/types.ts</files>
    <action>
      1. Create terminal/types.ts:
         - TerminalDetection: {status, confidence, prompt?, error?}
         - PromptType: 'permission' | 'question' | 'plan' | 'feedback'
         - DetectedPrompt: {type, text, options?}
      2. Create terminal/patterns.ts:
         - Centralized registry of all regex patterns
         - Categories: waiting, working, idle, error
         - Waiting patterns: permission prompts, question prompts, plan mode
         - Working patterns: spinner chars, "Thinking...", tool indicators
         - Idle patterns: ready for input, completed indicators
         - Error patterns: tool failures, rate limits
         - Version/date comments for tracking Claude Code compatibility
      3. Create terminal/parser.ts:
         - parseTerminal(content: string): TerminalDetection
         - Extract last 50 lines for analysis
         - Test patterns in priority order
         - Calculate confidence (0-1) based on match strength
         - Extract prompt text and options when detected
      4. Create terminal/index.ts:
         - Export parser and types
    </action>
    <verify>
      Parse terminal with permission prompt, verify detected as waiting
      Parse terminal with spinner, verify detected as working
      Parse idle terminal, verify detected as idle
    </verify>
    <done>Terminal parser detects prompts and states with confidence scoring</done>
  </task>

  <task id="2">
    <name>Implement session state machine and reconciler</name>
    <files>server-v2/sessions/index.ts, server-v2/sessions/manager.ts, server-v2/sessions/state-machine.ts, server-v2/sessions/reconciler.ts, server-v2/sessions/types.ts</files>
    <action>
      1. Create sessions/types.ts:
         - SessionStatus: 'idle' | 'typing' | 'working' | 'waiting' | 'error'
         - ClaudeSession interface: id, personaId, projectId, status, lastActivity
      2. Create sessions/state-machine.ts:
         - VALID_TRANSITIONS table
         - transitionSession(current, next): SessionStatus
         - Log transitions for debugging
      3. Create sessions/reconciler.ts:
         - Reconciliation rules:
           - Hook says working, terminal shows prompt → waiting (trust terminal)
           - Hook says waiting, no prompt visible → working (prompt answered)
           - Hook says working, terminal idle 5s+ → idle (missed stop)
           - Hook says working, terminal unknown 10s+ → idle (assume done)
         - reconcile(hookState, terminalState, timeSinceChange): SessionStatus
      4. Create sessions/manager.ts:
         - Session cache by pane ID
         - getOrCreateSession(paneId, personaId, projectId): ClaudeSession
         - updateSessionStatus(paneId, status, source): void
         - Emit session:status_changed events
      5. Create sessions/index.ts:
         - Export manager and types
         - Subscribe to pane events and hook events
         - Trigger reconciliation periodically
    </action>
    <verify>
      Create session, verify initial status is idle
      Simulate hook event, verify status changes
      Simulate conflicting states, verify reconciler resolves
    </verify>
    <done>Session state machine with reconciliation handles all state transitions</done>
  </task>
</plan>

## Verification Criteria
- [ ] Terminal parser detects all prompt types
- [ ] Confidence scores reflect match quality
- [ ] Session state machine enforces transitions
- [ ] Reconciler resolves hook vs terminal conflicts
- [ ] No "unknown" status persists > 30s
