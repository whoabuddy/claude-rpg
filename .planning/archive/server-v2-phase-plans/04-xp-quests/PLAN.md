# Phase 4: XP and Quests

## Goal
Redesign XP system with ledger tracking and implement quest state machine.

## Context
- XP earned by both personas and projects
- Every XP award tracked in xp_events table for star chart
- Quest state machine: manual implementation, XState-migration-friendly
- Issues: #121, #122

<plan>
  <goal>Create XP ledger system and quest state machine</goal>
  <context>
    - XP values defined per event type
    - Level progression: 100 * 1.5^(level-1)
    - Quest states: planned, active, paused, completed, failed, archived
    - Manual state machine with explicit transition tables
  </context>

  <task id="1">
    <name>Implement XP calculation and ledger</name>
    <files>server-v2/xp/index.ts, server-v2/xp/calculator.ts, server-v2/xp/ledger.ts, server-v2/xp/levels.ts, server-v2/xp/types.ts</files>
    <action>
      1. Create xp/types.ts:
         - XpEventType: tool usage, git ops, quests, achievements
         - XpEvent interface matching DB schema
         - XpGain event payload
      2. Create xp/calculator.ts:
         - XP_VALUES constant with all event type values
         - calculateXp(eventType, metadata?): number
         - Tool XP: Read=1, Edit=3, Write=5, Bash=2, Task=5
         - Git XP: commit=15, push=10, branch=5, pr_created=20, pr_merged=50
         - Quest XP: phase_planned=10, phase_verified=25, quest_completed=100
      3. Create xp/levels.ts:
         - xpForLevel(level): number (100 * 1.5^(level-1))
         - levelFromTotalXp(totalXp): {level, xpIntoLevel, xpForNext}
         - LEVEL_TITLES: Apprentice (1-4), Journeyman (5-9), Expert (10-14), Master (15-19), Grandmaster (20+)
      4. Create xp/ledger.ts:
         - recordXpEvent(personaId, projectId, eventType, amount, metadata): Promise<void>
         - getXpByCategory(entityType, entityId, since?): Promise<Record<string, number>>
         - getXpTimeline(entityType, entityId, days): Promise<{date, xp}[]>
      5. Create xp/index.ts:
         - Export all modules
         - Subscribe to post_tool_use, quest events
         - Award XP and emit xp:awarded event
    </action>
    <verify>
      Record XP event, verify it appears in xp_events table
      Calculate level from XP, verify correct
      Query XP by category, verify aggregation works
    </verify>
    <done>XP awarded and tracked in ledger, levels calculated correctly</done>
  </task>

  <task id="2">
    <name>Implement quest state machine</name>
    <files>server-v2/quests/index.ts, server-v2/quests/service.ts, server-v2/quests/state-machine.ts, server-v2/quests/types.ts</files>
    <action>
      1. Create quests/types.ts:
         - QuestStatus: 'planned' | 'active' | 'paused' | 'completed' | 'failed' | 'archived'
         - QuestPhaseStatus: 'pending' | 'planned' | 'executing' | 'retrying' | 'completed' | 'failed' | 'skipped'
         - Quest and QuestPhase interfaces
      2. Create quests/state-machine.ts:
         - VALID_QUEST_TRANSITIONS: Record<QuestStatus, QuestStatus[]>
         - VALID_PHASE_TRANSITIONS: Record<QuestPhaseStatus, QuestPhaseStatus[]>
         - transitionQuest(current, next): QuestStatus (throws on invalid)
         - transitionPhase(current, next): QuestPhaseStatus (throws on invalid)
         - Log transitions for debugging
      3. Create quests/service.ts:
         - createQuest(projectId, title, phases): Promise<Quest>
         - updateQuestStatus(questId, status): Promise<Quest>
         - updatePhaseStatus(questId, phaseId, status): Promise<Quest>
         - getActiveQuests(): Promise<Quest[]>
         - getQuestsByProject(projectId): Promise<Quest[]>
      4. Create quests/index.ts:
         - Export service and types
         - Subscribe to quest events from hooks
         - Emit quest:status_changed events
    </action>
    <verify>
      Create quest, verify status is 'planned'
      Transition to 'active', verify success
      Try invalid transition, verify throws
    </verify>
    <done>Quest state machine enforces valid transitions, persists to DB</done>
  </task>
</plan>

## Verification Criteria
- [ ] XP values correct for all event types
- [ ] XP events recorded to database
- [ ] Level calculation matches formula
- [ ] Quest state machine enforces transitions
- [ ] Invalid transitions throw errors
- [ ] Quests persist to SQLite
