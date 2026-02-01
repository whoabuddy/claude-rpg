# PLAN: Phase 6 - Consolidate Personas/Projects/Quests Pages

<plan>
  <goal>
    Combine PersonasPage, ProjectsPage, and QuestsPage into a single unified "Quests" page that shows all context in one place: active workers (personas), their projects, and associated quests.
  </goal>

  <context>
    Decision rationale:
    - Users don't need three separate pages for related concepts
    - Personas (workers) work ON projects FOR quests
    - Showing them together provides better context
    - Reduces navigation complexity

    Design:
    - Main content: Quest list with expandable phases
    - Sidebar/header: Active workers with project context
    - Each quest shows which project and which worker is assigned
    - Project stats visible in quest context

    Current pages to consolidate:
    - PersonasPage: shows active Claude sessions with health/badges
    - ProjectsPage: shows git repos with XP/level
    - QuestsPage: shows quests with phases

    New unified page structure:
    ```
    +------------------------------------------+
    | Quests                     [+ New Quest] |
    +------------------------------------------+
    | Active Workers (3)                       |
    | [Avatar] Alice - claude-rpg (working)    |
    | [Avatar] Bob - x402-api (idle)           |
    | [Avatar] Carol - stacks.js (waiting)     |
    +------------------------------------------+
    | Active Quests                            |
    | [Quest Card with phases and project]     |
    | [Quest Card with phases and project]     |
    +------------------------------------------+
    | Recent Projects                          |
    | [Project mini-card with quick stats]     |
    +------------------------------------------+
    ```
  </context>

  <task id="1">
    <name>Create unified QuestsPage layout</name>
    <files>src/routes/QuestsPage.tsx, src/components/QuestsPage.tsx</files>
    <action>
      1. Rewrite QuestsPage.tsx as the main component (not wrapper):
         ```tsx
         export default function QuestsPage() {
           const { connected } = useConnectionStatus()
           const claudePanes = useClaudePanes()  // Active workers
           const companions = useStore(state => state.companions)  // Projects
           const { quests, activeQuests, loading } = useQuests()

           return (
             <div className="flex flex-col h-full">
               <PageHeader title="Quests">
                 <button className="btn-primary">+ New Quest</button>
               </PageHeader>

               <div className="flex-1 overflow-y-auto p-4 space-y-6">
                 {/* Active Workers section */}
                 <ActiveWorkersSection panes={claudePanes} />

                 {/* Quests section */}
                 <QuestsSection quests={activeQuests} loading={loading} />

                 {/* Recent Projects section */}
                 <ProjectsSection companions={companions.slice(0, 6)} />
               </div>
             </div>
           )
         }
         ```

      2. Create ActiveWorkersSection component:
         ```tsx
         function ActiveWorkersSection({ panes }: { panes: TmuxPane[] }) {
           if (panes.length === 0) return null

           return (
             <section>
               <h2 className="text-sm font-medium text-rpg-text-muted mb-3">
                 Active Workers ({panes.length})
               </h2>
               <div className="flex flex-wrap gap-2">
                 {panes.map(pane => (
                   <WorkerPill key={pane.id} pane={pane} />
                 ))}
               </div>
             </section>
           )
         }
         ```

      3. Keep existing QuestsSection but inline it

      4. Create compact ProjectsSection:
         ```tsx
         function ProjectsSection({ companions }: { companions: Companion[] }) {
           if (companions.length === 0) return null

           return (
             <section>
               <div className="flex items-center justify-between mb-3">
                 <h2 className="text-sm font-medium text-rpg-text-muted">
                   Recent Projects
                 </h2>
                 <Link to="/projects" className="text-xs text-rpg-accent">
                   View all
                 </Link>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                 {companions.map(c => (
                   <ProjectMiniCard key={c.id} companion={c} />
                 ))}
               </div>
             </section>
           )
         }
         ```

      5. Delete src/components/QuestsPage.tsx (logic moved to route)
    </action>
    <verify>
      1. Navigate to /quests
      2. Verify all three sections render
      3. Verify workers section shows active Claude panes
      4. Verify quests section shows quest cards
      5. Verify projects section shows recent companions
      6. Test responsive layout
    </verify>
    <done>Unified QuestsPage layout with all three sections</done>
  </task>

  <task id="2">
    <name>Create compact components for unified page</name>
    <files>src/components/WorkerPill.tsx (new), src/components/ProjectMiniCard.tsx (new), src/components/QuestCard.tsx</files>
    <action>
      1. Create WorkerPill.tsx - compact worker display:
         ```tsx
         interface WorkerPillProps {
           pane: TmuxPane
         }

         export function WorkerPill({ pane }: WorkerPillProps) {
           const session = pane.process.claudeSession
           if (!session) return null

           return (
             <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rpg-card
                           border border-rpg-border rounded-full text-sm">
               <PaneAvatar pane={pane} size="xs" />
               <span className="font-medium text-rpg-text">{session.name}</span>
               <StatusDot status={session.status} />
               {pane.repo && (
                 <span className="text-rpg-text-dim text-xs">{pane.repo.name}</span>
               )}
             </div>
           )
         }
         ```

      2. Create ProjectMiniCard.tsx - compact project display:
         ```tsx
         interface ProjectMiniCardProps {
           companion: Companion
         }

         export function ProjectMiniCard({ companion }: ProjectMiniCardProps) {
           const { level } = levelFromTotalXP(companion.totalExperience)

           return (
             <Link
               to={`/projects/${companion.id}`}
               className="p-3 bg-rpg-card border border-rpg-border rounded-lg
                        hover:border-rpg-accent/50 transition-colors"
             >
               <div className="flex items-center justify-between">
                 <span className="font-medium text-rpg-text text-sm truncate">
                   {companion.name}
                 </span>
                 <span className="text-xs bg-rpg-accent/20 text-rpg-accent px-1.5 py-0.5 rounded">
                   Lv {level}
                 </span>
               </div>
               <div className="flex gap-3 mt-1 text-xs text-rpg-text-muted">
                 <span>{companion.stats.git.commits} commits</span>
                 {companion.streak.current > 0 && (
                   <span className="text-rpg-streak">{companion.streak.current}d</span>
                 )}
               </div>
             </Link>
           )
         }
         ```

      3. Update QuestCard to show project/worker context:
         - Add project name badge if quest has projectId
         - Show which worker is executing current phase
    </action>
    <verify>
      1. WorkerPill renders correctly with status and project
      2. ProjectMiniCard links work and show correct info
      3. QuestCard shows project context when available
      4. All components are visually consistent
    </verify>
    <done>Compact components created for unified page</done>
  </task>

  <task id="3">
    <name>Update routing and navigation</name>
    <files>src/App.tsx, src/components/Layout.tsx</files>
    <action>
      1. In App.tsx, remove PersonasPage and ProjectsPage routes:
         ```tsx
         // Remove these:
         // <Route path="/personas" element={<PersonasPage />} />
         // <Route path="/projects" element={<ProjectsPage />} />

         // Keep these:
         <Route path="/" element={<DashboardPage />} />
         <Route path="/quests" element={<QuestsPage />} />
         <Route path="/projects/:id" element={<ProjectDetailPage />} />
         <Route path="/leaderboard" element={<LeaderboardPage />} />
         <Route path="/scratchpad" element={<ScratchpadPage />} />
         <Route path="/settings" element={<SettingsPage />} />
         ```

      2. In Layout.tsx, update navigation:
         ```tsx
         // Desktop sidebar
         <SidebarItem to="/" icon="grid" label="Dashboard" end />
         <SidebarItem to="/quests" icon="scroll" label="Quests" />
         <SidebarItem to="/leaderboard" icon="trophy" label="Leaderboard" />
         <SidebarItem to="/scratchpad" icon="note" label="Scratchpad" />

         // Mobile nav
         <NavItem to="/" icon="grid" label="Home" end />
         <NavItem to="/quests" icon="scroll" label="Quests" />
         <NavItem to="/leaderboard" icon="trophy" label="Scores" />
         <NavItem to="/scratchpad" icon="note" label="Notes" />
         <NavItem to="/settings" icon="settings" label="More" />
         ```

      3. Delete old page files (or keep as archive):
         - src/routes/PersonasPage.tsx
         - src/routes/ProjectsPage.tsx

      4. Update any internal links that pointed to /personas or /projects
    </action>
    <verify>
      1. /personas redirects or 404s (not a route anymore)
      2. /projects redirects or 404s (not a route anymore)
      3. /projects/:id still works (detail page kept)
      4. Navigation only shows consolidated menu
      5. All links within the app work correctly
      6. No console errors about missing routes
    </verify>
    <done>Routes consolidated, old pages removed, navigation updated</done>
  </task>
</plan>

## Files Summary

**Create:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/WorkerPill.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/ProjectMiniCard.tsx`

**Major rewrite:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/QuestsPage.tsx`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/App.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/Layout.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/QuestCard.tsx`

**Delete:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/PersonasPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/ProjectsPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/QuestsPage.tsx`

## Commits

1. `feat(quests): create unified QuestsPage with workers and projects sections`
2. `feat(ui): add WorkerPill and ProjectMiniCard components`
3. `refactor(routes): remove PersonasPage and ProjectsPage, consolidate into Quests`
