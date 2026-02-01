# Phase 8: Achievements and Polish

## Goal
Implement achievements system with rarity tiers and unlock tracking.

## Context
- Achievements apply to personas, projects, or globally
- Rarity tiers: common, uncommon, rare, epic, legendary
- Check achievements on XP events
- Issue: #129

<plan>
  <goal>Create achievement system with categories and rarity tiers</goal>
  <context>
    - Reference existing server/achievements.ts for patterns
    - Achievement checks run on xp:awarded and other events
    - Prevent duplicate unlocks
    - Achievement queuing handled on client side
  </context>

  <task id="1">
    <name>Implement achievement definitions and checker</name>
    <files>server-v2/achievements/index.ts, server-v2/achievements/definitions.ts, server-v2/achievements/checker.ts, server-v2/achievements/types.ts</files>
    <action>
      1. Create achievements/types.ts:
         - AchievementRarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
         - AchievementCategory: 'getting_started' | 'git' | 'testing' | 'quests' | 'streaks' | 'milestones' | 'blockchain'
         - AchievementScope: 'persona' | 'project' | 'global'
         - AchievementDefinition: {id, name, description, icon, category, rarity, scope, check}
         - UnlockedAchievement: {id, entityType, entityId, achievementId, unlockedAt}
      2. Create achievements/definitions.ts:
         - All achievement definitions organized by category
         - Getting started: first_blood, hello_world, tool_time
         - Git: committer (10), century (100), pr_champion
         - Testing: test_pilot, test_warrior, quality_guardian
         - Quests: adventurer (5), hero (25), legend (100)
         - Streaks: consistent (3d), dedicated (7d), streak_master (30d), unstoppable (100d)
         - Milestones: rising_star (1K XP), veteran (10K), legend (100K)
         - Blockchain: testnet_pioneer, mainnet_hero, clarity_sage
      3. Create achievements/checker.ts:
         - checkAchievements(entityType, entityId, stats, meta): AchievementDefinition[]
         - Returns newly unlocked achievements (not already unlocked)
         - Check all definitions against entity stats
      4. Create achievements/index.ts:
         - Export checker and types
         - Subscribe to xp:awarded event
         - Check achievements for persona and project
         - Emit achievement:unlocked event
         - Persist to database
    </action>
    <verify>
      Trigger first commit for persona, verify first_blood unlocked
      Try to unlock again, verify no duplicate
      Check rarity is stored correctly
    </verify>
    <done>Achievement system tracks unlocks and emits events</done>
  </task>

  <task id="2">
    <name>Add achievement queries and stats helpers</name>
    <files>server-v2/achievements/queries.ts, server-v2/db/queries.ts</files>
    <action>
      1. Create achievements/queries.ts:
         - getUnlockedAchievements(entityType, entityId): UnlockedAchievement[]
         - getAllAchievementsWithStatus(entityType, entityId): (AchievementDef & {unlocked?})[]
         - getRecentUnlocks(limit): UnlockedAchievement[]
      2. Update db/queries.ts:
         - Add stats aggregation queries
         - getEntityStats(entityType, entityId): stats object for achievement checking
         - Streak calculation queries
    </action>
    <verify>
      Unlock some achievements, query them back
      Verify progress data for locked achievements
    </verify>
    <done>Achievement queries work for display and progress tracking</done>
  </task>
</plan>

## Verification Criteria
- [ ] All achievement categories defined
- [ ] Achievements unlock on criteria met
- [ ] No duplicate unlocks
- [ ] Rarity tiers applied correctly
- [ ] Achievements persist to database
- [ ] Achievement events emitted for client
