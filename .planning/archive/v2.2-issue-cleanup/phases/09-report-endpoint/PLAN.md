# PLAN: Phase 9 - State/History Report Endpoint

<plan>
  <goal>
    Add a GET /api/report endpoint that returns a summary of current state and recent activity, formatted for integration with /daily-brief and other reporting tools.
  </goal>

  <context>
    Issue #165: Report on current state/recent history

    Use case:
    - /daily-brief skill needs to know what happened since last check
    - External tools want to query claude-rpg status
    - Provides structured data for LLM context

    Report should include:
    - Active personas (names, projects, statuses)
    - Recent quests (active, completed today)
    - XP gained today (total, by project)
    - Activity summary (commits, tests, tool uses)
    - Notable events (achievements, level-ups)

    Files to read:
    - server-v2/xp/ledger.ts (XP history)
    - server-v2/personas/service.ts
    - server-v2/quests/service.ts
    - server-v2/companions/service.ts
  </context>

  <task id="1">
    <name>Create report service module</name>
    <files>server-v2/report/index.ts (new)</files>
    <action>
      1. Create report/index.ts with generateReport function:
         ```typescript
         import { getActivePersonas } from '../personas/service'
         import { getActiveQuests, getQuestsByStatus } from '../quests/service'
         import { getAllCompanions } from '../companions/service'
         import { getXpEventsSince } from '../xp/ledger'
         import { queries } from '../db'

         export interface DailyReport {
           generatedAt: string
           period: {
             start: string  // ISO timestamp
             end: string    // ISO timestamp
           }
           summary: {
             activePersonas: number
             activeQuests: number
             completedQuests: number
             totalXpGained: number
           }
           personas: Array<{
             name: string
             status: 'active' | 'idle'
             project: string | null
             xpGained: number
           }>
           quests: Array<{
             title: string
             status: string
             phasesComplete: number
             phasesTotal: number
           }>
           projects: Array<{
             name: string
             level: number
             xpGained: number
             commits: number
             streak: number
           }>
           highlights: string[]  // Notable events for the period
         }

         export function generateReport(sinceDaysAgo: number = 1): DailyReport {
           const now = new Date()
           const start = new Date(now.getTime() - sinceDaysAgo * 24 * 60 * 60 * 1000)

           const personas = getActivePersonas()
           const activeQuests = getActiveQuests()
           const completedQuests = getQuestsByStatus('completed')
             .filter(q => q.completedAt && new Date(q.completedAt) >= start)
           const companions = getAllCompanions()
           const xpEvents = getXpEventsSince(start.toISOString())

           // Calculate XP by persona
           const xpByPersona = new Map<string, number>()
           for (const event of xpEvents) {
             const current = xpByPersona.get(event.personaId) || 0
             xpByPersona.set(event.personaId, current + event.amount)
           }

           // Calculate XP by project
           const xpByProject = new Map<string, number>()
           for (const event of xpEvents) {
             if (event.projectId) {
               const current = xpByProject.get(event.projectId) || 0
               xpByProject.set(event.projectId, current + event.amount)
             }
           }

           // Build highlights
           const highlights: string[] = []
           if (completedQuests.length > 0) {
             highlights.push(`Completed ${completedQuests.length} quest(s)`)
           }
           // ... add more highlight logic

           return {
             generatedAt: now.toISOString(),
             period: {
               start: start.toISOString(),
               end: now.toISOString(),
             },
             summary: {
               activePersonas: personas.length,
               activeQuests: activeQuests.length,
               completedQuests: completedQuests.length,
               totalXpGained: Array.from(xpByPersona.values()).reduce((a, b) => a + b, 0),
             },
             personas: personas.map(p => ({
               name: p.name,
               status: p.status,
               project: null, // TODO: link to project
               xpGained: xpByPersona.get(p.id) || 0,
             })),
             quests: [...activeQuests, ...completedQuests].map(q => ({
               title: q.title,
               status: q.status,
               phasesComplete: q.phases.filter(p => p.status === 'completed').length,
               phasesTotal: q.phases.length,
             })),
             projects: companions.slice(0, 10).map(c => ({
               name: c.name,
               level: c.level,
               xpGained: xpByProject.get(c.id) || 0,
               commits: c.stats.git.commits,
               streak: c.streak.current,
             })),
             highlights,
           }
         }
         ```

      2. Add getXpEventsSince to xp/ledger.ts if not exists:
         ```typescript
         export function getXpEventsSince(since: string): XpEvent[] {
           return queries.getXpEventsSince.all(since) as XpEvent[]
         }
         ```
    </action>
    <verify>
      1. Import and call generateReport() in a test file
      2. Verify structure matches interface
      3. Verify data is populated correctly
      4. Test with different time ranges
    </verify>
    <done>Report service module generates structured daily reports</done>
  </task>

  <task id="2">
    <name>Add API endpoint</name>
    <files>server-v2/api/routes.ts, server-v2/api/handlers.ts</files>
    <action>
      1. Add route in routes.ts:
         ```typescript
         { method: 'GET', pattern: '/api/report', handler: 'getReport' },
         ```

      2. Add handler in handlers.ts:
         ```typescript
         import { generateReport } from '../report'

         export async function getReport(req: Request): Promise<Response> {
           try {
             // Parse query params
             const url = new URL(req.url)
             const days = parseInt(url.searchParams.get('days') || '1', 10)

             // Validate
             if (isNaN(days) || days < 1 || days > 30) {
               return Response.json(
                 { success: false, error: 'days must be 1-30' },
                 { status: 400 }
               )
             }

             const report = generateReport(days)
             return Response.json({ success: true, data: report })
           } catch (error) {
             return Response.json(
               { success: false, error: String(error) },
               { status: 500 }
             )
           }
         }
         ```

      3. Add to handler exports
    </action>
    <verify>
      1. Start server
      2. curl http://localhost:4011/api/report | jq
      3. Verify response has expected structure
      4. curl http://localhost:4011/api/report?days=7
      5. Verify longer time range returns more data
      6. curl http://localhost:4011/api/report?days=0
      7. Verify error response for invalid days
    </verify>
    <done>GET /api/report endpoint returns daily report</done>
  </task>

  <task id="3">
    <name>Format for daily brief integration</name>
    <files>server-v2/report/index.ts</files>
    <action>
      1. Add toMarkdown() method for easy LLM consumption:
         ```typescript
         export function reportToMarkdown(report: DailyReport): string {
           const lines: string[] = []

           lines.push(`# Claude RPG Daily Report`)
           lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`)
           lines.push('')

           lines.push(`## Summary`)
           lines.push(`- ${report.summary.activePersonas} active workers`)
           lines.push(`- ${report.summary.activeQuests} quests in progress`)
           lines.push(`- ${report.summary.completedQuests} quests completed`)
           lines.push(`- ${report.summary.totalXpGained} XP gained`)
           lines.push('')

           if (report.highlights.length > 0) {
             lines.push(`## Highlights`)
             for (const h of report.highlights) {
               lines.push(`- ${h}`)
             }
             lines.push('')
           }

           if (report.quests.length > 0) {
             lines.push(`## Quests`)
             for (const q of report.quests) {
               const progress = `${q.phasesComplete}/${q.phasesTotal}`
               lines.push(`- **${q.title}** (${q.status}) - ${progress} phases`)
             }
             lines.push('')
           }

           if (report.projects.length > 0) {
             lines.push(`## Projects`)
             for (const p of report.projects) {
               const streak = p.streak > 0 ? ` (${p.streak}d streak)` : ''
               lines.push(`- **${p.name}** Lv${p.level} - +${p.xpGained} XP${streak}`)
             }
           }

           return lines.join('\n')
         }
         ```

      2. Add format query param to endpoint:
         ```typescript
         const format = url.searchParams.get('format') || 'json'

         if (format === 'markdown') {
           return new Response(reportToMarkdown(report), {
             headers: { 'Content-Type': 'text/markdown' },
           })
         }
         ```
    </action>
    <verify>
      1. curl http://localhost:4011/api/report?format=markdown
      2. Verify markdown output is well-formatted
      3. Verify it's readable as plain text
      4. Test with /daily-brief skill if available
    </verify>
    <done>Report can be output as markdown for LLM consumption</done>
  </task>
</plan>

## Files Summary

**Create:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/report/index.ts`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/routes.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/api/handlers.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/xp/ledger.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/server-v2/db/queries.ts`

## Commits

1. `feat(report): add report service for daily summaries`
2. `feat(api): add GET /api/report endpoint`
3. `feat(report): add markdown output format for daily brief integration`
