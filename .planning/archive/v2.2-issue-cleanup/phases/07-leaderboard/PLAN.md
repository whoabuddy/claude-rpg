# PLAN: Phase 7 - Leaderboard Improvements

<plan>
  <goal>
    Improve leaderboard UX with better defaults (today), time period toggles, and links to persona/project details.
  </goal>

  <context>
    Issue #179 requirements:
    - Default to "today" time period (not "all time")
    - Add toggle buttons for time periods (today/week/all)
    - Connect entries to personas and achievements
    - Show streak info inline

    Current state:
    - CompetitionsPage shows leaderboard data
    - Data comes from /api/competitions and WebSocket
    - LeaderboardCard shows individual entries
    - Time period selection exists but may not be prominent

    Files to read:
    - src/components/CompetitionsPage.tsx
    - src/components/LeaderboardCard.tsx
    - server-v2/competitions/index.ts
  </context>

  <task id="1">
    <name>Add prominent time period toggles</name>
    <files>src/components/CompetitionsPage.tsx</files>
    <action>
      1. Add state for selected time period (default to 'today'):
         ```tsx
         const [timePeriod, setTimePeriod] = useState<TimePeriod>('today')
         ```

      2. Create TimePeriodToggle component:
         ```tsx
         function TimePeriodToggle({ value, onChange }: {
           value: TimePeriod
           onChange: (period: TimePeriod) => void
         }) {
           return (
             <div className="inline-flex rounded-lg border border-rpg-border bg-rpg-card p-0.5">
               {(['today', 'week', 'all'] as const).map(period => (
                 <button
                   key={period}
                   onClick={() => onChange(period)}
                   className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                     value === period
                       ? 'bg-rpg-accent text-rpg-bg'
                       : 'text-rpg-text-muted hover:text-rpg-text'
                   }`}
                 >
                   {period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'All Time'}
                 </button>
               ))}
             </div>
           )
         }
         ```

      3. Put toggle in PageHeader actions:
         ```tsx
         <PageHeader title="Leaderboard">
           <TimePeriodToggle value={timePeriod} onChange={setTimePeriod} />
         </PageHeader>
         ```

      4. Filter displayed competitions by time period:
         ```tsx
         const filteredCompetitions = competitions.filter(c => c.period === timePeriod)
         ```
    </action>
    <verify>
      1. Open leaderboard page
      2. Verify default shows "Today" selected
      3. Click "This Week" - verify data updates
      4. Click "All Time" - verify data updates
      5. Toggle styling is clear (selected state obvious)
    </verify>
    <done>Time period toggle with today as default</done>
  </task>

  <task id="2">
    <name>Link entries to project details</name>
    <files>src/components/LeaderboardCard.tsx, src/components/CompetitionsPage.tsx</files>
    <action>
      1. In LeaderboardCard, make entries clickable:
         ```tsx
         interface LeaderboardCardProps {
           entry: LeaderboardEntry
           category: CompetitionCategory
           onSelect?: (companionId: string) => void
         }

         export function LeaderboardCard({ entry, category, onSelect }: LeaderboardCardProps) {
           return (
             <button
               onClick={() => onSelect?.(entry.companionId)}
               className="w-full flex items-center gap-3 p-3 bg-rpg-card border border-rpg-border
                        rounded-lg hover:border-rpg-accent/50 transition-colors text-left"
             >
               {/* Rank badge */}
               <div className={`w-8 h-8 rounded-full flex items-center justify-center
                             font-bold text-sm ${getRankStyle(entry.rank)}`}>
                 {entry.rank}
               </div>

               {/* Name and details */}
               <div className="flex-1 min-w-0">
                 <p className="font-medium text-rpg-text truncate">
                   {entry.companionName}
                 </p>
                 <p className="text-xs text-rpg-text-muted">
                   {formatValue(entry.value, category)}
                 </p>
               </div>

               {/* Streak badge */}
               {entry.streak.current > 0 && (
                 <div className="text-xs text-rpg-streak">
                   {entry.streak.current}d streak
                 </div>
               )}

               {/* Change indicator */}
               {entry.change !== undefined && entry.change !== 0 && (
                 <div className={entry.change > 0 ? 'text-rpg-success' : 'text-rpg-error'}>
                   {entry.change > 0 ? '↑' : '↓'}{Math.abs(entry.change)}
                 </div>
               )}
             </button>
           )
         }
         ```

      2. In CompetitionsPage, handle selection:
         ```tsx
         const navigate = useNavigate()

         function handleSelectCompanion(companionId: string) {
           navigate(`/projects/${companionId}`)
         }
         ```

      3. Add helper for rank styling:
         ```tsx
         function getRankStyle(rank: number): string {
           if (rank === 1) return 'bg-rpg-gold text-rpg-bg'
           if (rank === 2) return 'bg-gray-400 text-rpg-bg'
           if (rank === 3) return 'bg-amber-700 text-white'
           return 'bg-rpg-border text-rpg-text-muted'
         }
         ```
    </action>
    <verify>
      1. Click on a leaderboard entry
      2. Verify navigation to project detail page
      3. Verify streak displays inline
      4. Verify rank badges have appropriate styling (gold/silver/bronze)
      5. Verify change indicators show when available
    </verify>
    <done>Leaderboard entries link to project details with inline stats</done>
  </task>

  <task id="3">
    <name>Show category tabs with icons</name>
    <files>src/components/CompetitionsPage.tsx</files>
    <action>
      1. Add category selection (in addition to time period):
         ```tsx
         const [category, setCategory] = useState<CompetitionCategory>('xp')
         ```

      2. Create category tabs with icons:
         ```tsx
         const CATEGORIES: { id: CompetitionCategory; label: string; icon: string }[] = [
           { id: 'xp', label: 'XP', icon: '⚡' },
           { id: 'commits', label: 'Commits', icon: '📝' },
           { id: 'tests', label: 'Tests', icon: '✓' },
           { id: 'tools', label: 'Tools', icon: '🔧' },
           { id: 'prompts', label: 'Prompts', icon: '💬' },
           { id: 'quests', label: 'Quests', icon: '📜' },
         ]

         function CategoryTabs({ value, onChange }: {
           value: CompetitionCategory
           onChange: (cat: CompetitionCategory) => void
         }) {
           return (
             <div className="flex gap-1 overflow-x-auto pb-2">
               {CATEGORIES.map(cat => (
                 <button
                   key={cat.id}
                   onClick={() => onChange(cat.id)}
                   className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg
                             whitespace-nowrap transition-colors ${
                     value === cat.id
                       ? 'bg-rpg-accent/15 text-rpg-accent'
                       : 'text-rpg-text-muted hover:bg-rpg-card'
                   }`}
                 >
                   <span>{cat.icon}</span>
                   <span>{cat.label}</span>
                 </button>
               ))}
             </div>
           )
         }
         ```

      3. Filter competitions by both time period and category:
         ```tsx
         const selectedCompetition = competitions.find(
           c => c.period === timePeriod && c.category === category
         )
         ```

      4. Show the filtered leaderboard:
         ```tsx
         {selectedCompetition ? (
           <div className="space-y-2">
             {selectedCompetition.entries.map(entry => (
               <LeaderboardCard
                 key={entry.companionId}
                 entry={entry}
                 category={category}
                 onSelect={handleSelectCompanion}
               />
             ))}
           </div>
         ) : (
           <p className="text-rpg-text-dim text-center py-8">
             No data for this category
           </p>
         )}
         ```
    </action>
    <verify>
      1. Category tabs display with icons
      2. Selecting category updates the leaderboard
      3. Combined with time period (today + XP, week + commits, etc.)
      4. Horizontal scroll works on mobile for many categories
      5. Empty state shows when no data
    </verify>
    <done>Category tabs with icons for filtering leaderboards</done>
  </task>
</plan>

## Files Summary

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/CompetitionsPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/LeaderboardCard.tsx`

## Commits

1. `feat(leaderboard): add time period toggle with today as default`
2. `feat(leaderboard): link entries to project details, show streaks inline`
3. `feat(leaderboard): add category tabs with icons`
