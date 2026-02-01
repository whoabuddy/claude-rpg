# Phase 7: Add Project Aggregation and Narrative

## Goal

Add project-level aggregation (team stats), team leaderboard, and narrative summary generator with export.

## Context

**Existing Infrastructure:**
- `server-v2/projects/service.ts` has basic project CRUD with `getAllProjects()`, `getProjectById()`, `addXp()`
- `server-v2/xp/ledger.ts` has `getXpByCategory()` and `getXpTimeline()` for XP queries
- `server-v2/db/schema.ts` has `xp_events` table linking persona_id and project_id
- The existing ProjectDetailPage in `src/components/ProjectDetailPage.tsx` shows basic stats
- LeaderboardPage uses CompetitionsPage which shows project-based leaderboards

**XP Event Schema:**
```sql
xp_events (
  id INTEGER PRIMARY KEY,
  persona_id TEXT,  -- Claude session that earned XP
  project_id TEXT,  -- Project where work was done
  event_type TEXT,  -- tool:Edit, git:commit, etc.
  xp_amount INTEGER,
  metadata TEXT,
  created_at TEXT
)
```

**Key Insight:** XP events already track both persona_id and project_id. Aggregation queries can:
1. Sum XP per project from xp_events WHERE project_id = ?
2. Count unique personas per project via SELECT DISTINCT persona_id
3. Group by event_type for stat breakdowns (commits, tests, tools used)

**Narrative Pattern:**
The existing ProjectDetailPage already has narrative generation inline (lines 88-128). This phase extracts and enhances that logic into a reusable service with:
- Milestone-aware descriptions ("First commit", "10th quest completed")
- Time-based insights ("Most active on Mondays")
- Persona contribution highlights ("Alice contributed 40% of commits")

<plan>
  <goal>Add project aggregation service, narrative generator, team stats components, and API export endpoint</goal>
  <context>
    Projects already accumulate XP via xp_events table. Need to add:
    1. Aggregation module to compute team stats from xp_events
    2. Narrative module to generate story-like text from stats
    3. API endpoint for exporting narrative as markdown/JSON
    4. Enhanced ProjectDetailPage with team section and narrative export
  </context>

  <task id="1">
    <name>Add project aggregation service</name>
    <files>server-v2/projects/aggregation.ts, server-v2/projects/index.ts, server-v2/db/index.ts</files>
    <action>
1. Create server-v2/projects/aggregation.ts with these functions:

   ```typescript
   interface TeamStats {
     totalXp: number
     uniquePersonas: number
     personaContributions: Array<{
       personaId: string
       personaName: string
       xp: number
       percentage: number
       commits: number
       topTools: string[]
     }>
     topTools: Record<string, number>  // tool name -> usage count
     gitStats: {
       totalCommits: number
       totalPushes: number
       totalPrs: number
     }
     questStats: {
       created: number
       completed: number
       phasesCompleted: number
     }
     activityByDay: Record<string, number>  // day of week -> XP earned
     firstActivity: string  // ISO date
     lastActivity: string
   }

   // Main aggregation function
   export function getProjectTeamStats(projectId: string): TeamStats
   ```

2. Add new database queries to server-v2/db/index.ts:
   - getXpEventsByProject: Get all XP events for a project
   - getUniquePersonasByProject: SELECT DISTINCT persona_id with names
   - getXpSumByPersonaForProject: GROUP BY persona_id, SUM xp_amount
   - getEventCountByType: GROUP BY event_type

3. Implement aggregation logic:
   - Query xp_events WHERE project_id = ?
   - Group by persona_id to get contributions
   - Extract tool usage from event_type (tool:Edit -> Edit)
   - Calculate percentages (persona XP / total XP * 100)
   - Parse created_at dates to get day-of-week distribution
   - Join with personas table to get names

4. Export from server-v2/projects/index.ts
    </action>
    <verify>
Run server and test with:
```bash
# Add a test call in index.ts or test file
import { getProjectTeamStats } from './projects/aggregation'
const stats = getProjectTeamStats('some-project-id')
console.log(JSON.stringify(stats, null, 2))
```
Should return TeamStats object with valid structure.
    </verify>
    <done>getProjectTeamStats() returns aggregated team statistics for a project</done>
  </task>

  <task id="2">
    <name>Add narrative generator and API endpoint</name>
    <files>server-v2/projects/narrative.ts, server-v2/api/routes.ts, server-v2/api/handlers.ts, server-v2/api/types.ts</files>
    <action>
1. Create server-v2/projects/narrative.ts:

   ```typescript
   interface NarrativeSummary {
     title: string           // "claude-rpg: A Story of Code"
     tagline: string         // "Level 5 backend project"
     teamSection: string[]   // Paragraphs about team
     activitySection: string[]
     milestonesSection: string[]
     markdown: string        // Full formatted markdown
   }

   export function generateNarrative(
     projectId: string,
     projectName: string,
     level: number,
     teamStats: TeamStats
   ): NarrativeSummary
   ```

2. Implement narrative generation:
   - Title: "{projectName}: A Story of Code"
   - Team section:
     - If 1 persona: "{name} has been the sole contributor..."
     - If multiple: "This project has been shaped by {n} contributors..."
     - Top contributor highlight: "{name} led with {percent}% of XP..."
   - Activity section:
     - Total work: "{totalXp} XP earned across {commits} commits"
     - Peak day: "Most active on {dayOfWeek}s"
     - Timeline: "Started {firstActivity}, last active {lastActivity}"
   - Milestones section:
     - Level milestone: "Reached level {level}"
     - Quest completions: "Conquered {n} quests"
     - Tool mastery: "Mastered {topTool} with {count} uses"
   - Assemble into markdown with headers

3. Add API route GET /api/projects/:id/narrative to routes.ts:
   ```typescript
   { method: 'GET', pattern: '/api/projects/:id/narrative', handler: 'getProjectNarrative' }
   ```

4. Add handler to handlers.ts:
   ```typescript
   export function getProjectNarrative(params: Record<string, string>, query: URLSearchParams): ApiResponse<unknown> {
     const format = query.get('format') || 'json'  // json or markdown
     const project = getProjectById(params.id)
     if (!project) return { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }

     const teamStats = getProjectTeamStats(params.id)
     const narrative = generateNarrative(params.id, project.name, project.level, teamStats)

     if (format === 'markdown') {
       return { success: true, data: { markdown: narrative.markdown } }
     }
     return { success: true, data: { narrative, teamStats } }
   }
   ```

5. Add NarrativeResponse type to types.ts

6. Export generateNarrative from server-v2/projects/index.ts
    </action>
    <verify>
```bash
curl "http://localhost:4011/api/projects/PROJECT_ID/narrative"
# Returns JSON with narrative and teamStats

curl "http://localhost:4011/api/projects/PROJECT_ID/narrative?format=markdown"
# Returns { success: true, data: { markdown: "# ..." } }
```
    </verify>
    <done>GET /api/projects/:id/narrative returns narrative summary in JSON or markdown format</done>
  </task>

  <task id="3">
    <name>Add UI components and update ProjectDetailPage</name>
    <files>src/components/TeamStats.tsx, src/components/NarrativeSummary.tsx, src/components/ProjectDetailPage.tsx, src/lib/api.ts</files>
    <action>
1. Create src/components/TeamStats.tsx:
   - Props: teamStats: TeamStats, loading: boolean
   - Display:
     - Total XP badge with level
     - Team size (unique personas count)
     - Contribution bar chart (horizontal bars for each persona)
     - Top tools list with usage counts
     - Activity heatmap by day of week (7 boxes with intensity)
   - Use existing RPG styling (border-rpg-border, bg-rpg-card, etc.)

2. Create src/components/NarrativeSummary.tsx:
   - Props: narrative: NarrativeSummary | null, loading: boolean, onExport: () => void
   - Display:
     - Title and tagline
     - Expandable sections for team, activity, milestones
     - "Export as Markdown" button (calls onExport)
   - Export button copies markdown to clipboard or downloads file

3. Add API function to src/lib/api.ts:
   ```typescript
   export async function getProjectNarrative(projectId: string, format: 'json' | 'markdown' = 'json') {
     const url = `${BASE_URL}/api/projects/${projectId}/narrative?format=${format}`
     const res = await fetch(url)
     return res.json()
   }
   ```

4. Update src/components/ProjectDetailPage.tsx:
   - Add state: teamStats, narrative, loadingTeam
   - Fetch team stats on mount: useEffect with getProjectNarrative()
   - Add "Team" section before existing stats grid:
     - <TeamStats teamStats={teamStats} loading={loadingTeam} />
   - Add "Story" section at bottom:
     - <NarrativeSummary narrative={narrative} onExport={handleExport} />
   - handleExport: Download narrative.markdown as .md file
   - Keep existing "Project Story" as simple inline text (for projects without team data)
    </action>
    <verify>
1. Navigate to /projects/:id
2. See TeamStats card with:
   - XP total and team count
   - Persona contribution bars (if multiple personas)
   - Top tools used
   - Day-of-week activity chart
3. See NarrativeSummary section with:
   - Expandable story paragraphs
   - Working "Export" button that downloads markdown file
4. Empty state shows gracefully for new projects with no XP events
    </verify>
    <done>ProjectDetailPage shows team stats, narrative summary, and export functionality</done>
  </task>
</plan>

## Issue

Addresses #151 (complete)

## Commit Format

Task 1:
```
feat(projects): add team stats aggregation

- Add getProjectTeamStats() to aggregate XP by persona
- Calculate contribution percentages and activity patterns
- Add database queries for project-level aggregation

Addresses #151
```

Task 2:
```
feat(projects): add narrative generator with API endpoint

- Generate story-like text from project stats
- Add GET /api/projects/:id/narrative endpoint
- Support JSON and markdown output formats

Addresses #151
```

Task 3:
```
feat(ui): add TeamStats and NarrativeSummary components

- Create TeamStats component with contribution visualization
- Create NarrativeSummary with expandable sections
- Update ProjectDetailPage with team stats and export

Closes #151
```
