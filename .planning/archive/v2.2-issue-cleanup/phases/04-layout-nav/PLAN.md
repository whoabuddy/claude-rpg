# PLAN: Phase 4 - Standardize Layout and Navigation

<plan>
  <goal>
    Create consistent layout patterns across all pages with standardized headers, navigation, and settings access on mobile.
  </goal>

  <context>
    Current state:
    - Layout.tsx has sidebar (desktop) and bottom nav (mobile)
    - Each page has its own header implementation
    - Inconsistent back buttons, titles, action areas
    - Settings not in mobile nav (only desktop sidebar)
    - Menu items could be reordered for better UX

    Issues to address:
    - #172: Consistent headers with back-to-dashboard
    - #167: Reorder menu, rename to "tmux tracker", settings on mobile

    Pattern to establish:
    - PageHeader component with: back button (optional), title, actions slot
    - Consistent spacing and typography
    - Mobile-first responsive design

    Files to read:
    - src/components/Layout.tsx (current nav structure)
    - src/routes/SettingsPage.tsx (current header pattern)
    - src/routes/QuestsPage.tsx (another header pattern)
  </context>

  <task id="1">
    <name>Create shared PageHeader component</name>
    <files>src/components/PageHeader.tsx (new), src/routes/SettingsPage.tsx</files>
    <action>
      1. Create PageHeader.tsx:
         ```tsx
         interface PageHeaderProps {
           title: string
           backTo?: string  // Route to go back to, undefined = no back button
           backLabel?: string  // Accessible label for back button
           children?: React.ReactNode  // Actions slot (right side)
         }

         export function PageHeader({ title, backTo, backLabel, children }: PageHeaderProps) {
           const navigate = useNavigate()

           return (
             <header className="flex items-center gap-3 px-4 py-3 border-b border-rpg-border bg-rpg-bg-elevated">
               {backTo && (
                 <button
                   onClick={() => navigate(backTo)}
                   className="p-1.5 -ml-1.5 text-rpg-text-muted hover:text-rpg-text rounded-lg hover:bg-rpg-card transition-colors"
                   aria-label={backLabel || 'Go back'}
                 >
                   <ChevronLeftIcon className="w-5 h-5" />
                 </button>
               )}
               <h1 className="text-lg font-bold text-rpg-text flex-1">{title}</h1>
               {children && (
                 <div className="flex items-center gap-2">
                   {children}
                 </div>
               )}
             </header>
           )
         }
         ```

      2. Refactor SettingsPage to use PageHeader:
         ```tsx
         <PageHeader title="Settings" backTo="/" />
         ```

      3. Export from components/index.ts if that exists
    </action>
    <verify>
      1. Navigate to Settings page
      2. Verify header looks consistent
      3. Verify back button navigates to dashboard
      4. Verify title and spacing look good
      5. Test on mobile viewport
    </verify>
    <done>PageHeader component created and used in SettingsPage</done>
  </task>

  <task id="2">
    <name>Update navigation menu order and labels</name>
    <files>src/components/Layout.tsx</files>
    <action>
      1. Reorder menu items logically:
         - Dashboard (overview, always first)
         - Quests (primary activity tracking)
         - Leaderboard (gamification)
         - Scratchpad (notes/capture)
         - Settings (at bottom)

         Remove separate Personas and Projects nav items (they'll be consolidated into Quests page in Phase 6).

      2. Update desktop sidebar:
         ```tsx
         <nav className="flex-1 p-2 space-y-1">
           <SidebarItem to="/" icon="grid" label="Dashboard" end />
           <SidebarItem to="/quests" icon="scroll" label="Quests" />
           <SidebarItem to="/leaderboard" icon="trophy" label="Leaderboard" />
           <SidebarItem to="/scratchpad" icon="note" label="Scratchpad" />
         </nav>
         <div className="p-2 border-t border-rpg-border">
           <SidebarItem to="/settings" icon="settings" label="Settings" />
         </div>
         ```

      3. Update mobile bottom nav to include Settings:
         ```tsx
         <nav className="sm:hidden fixed bottom-0 ...">
           <NavItem to="/" icon="grid" label="Home" end />
           <NavItem to="/quests" icon="scroll" label="Quests" />
           <NavItem to="/leaderboard" icon="trophy" label="Scores" />
           <NavItem to="/scratchpad" icon="note" label="Notes" />
           <NavItem to="/settings" icon="settings" label="Settings" />
         </nav>
         ```

      4. Update branding text:
         ```tsx
         <h1 className="font-bold text-rpg-text leading-tight">tmux tracker</h1>
         <p className="text-[10px] text-rpg-text-dim tracking-wide">CLAUDE COMPANION</p>
         ```
    </action>
    <verify>
      1. Check desktop sidebar order matches specification
      2. Check mobile nav includes Settings
      3. Verify all nav items work (no broken routes yet - routes come later)
      4. Verify branding shows "tmux tracker"
      5. Test tap targets on mobile (should be at least 44px)
    </verify>
    <done>Navigation reordered with Settings on mobile</done>
  </task>

  <task id="3">
    <name>Apply PageHeader to all pages</name>
    <files>src/routes/QuestsPage.tsx, src/routes/LeaderboardPage.tsx, src/routes/ScratchpadPage.tsx, src/routes/ProjectDetailPage.tsx</files>
    <action>
      1. Update QuestsPage:
         ```tsx
         <PageHeader title="Quests">
           <FilterButtons ... />
         </PageHeader>
         ```

      2. Update LeaderboardPage:
         ```tsx
         <PageHeader title="Leaderboard">
           <TimePeriodToggle ... />
         </PageHeader>
         ```

      3. Update ScratchpadPage:
         ```tsx
         <PageHeader title="Scratchpad">
           <NewNoteButton ... />
         </PageHeader>
         ```

      4. Update ProjectDetailPage:
         ```tsx
         <PageHeader title={project.name} backTo="/quests" />
         ```

      5. Dashboard doesn't need PageHeader (it's the home page)

      6. Remove inline header implementations from each page
    </action>
    <verify>
      1. Visit each page and verify consistent header appearance
      2. Verify back buttons work where present
      3. Verify actions render in the correct position
      4. Test responsive behavior (mobile/desktop)
      5. No console errors
    </verify>
    <done>All pages use consistent PageHeader component</done>
  </task>
</plan>

## Files Summary

**Create:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PageHeader.tsx`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/Layout.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/SettingsPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/QuestsPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/LeaderboardPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/ScratchpadPage.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/routes/ProjectDetailPage.tsx`

## Commits

1. `feat(ui): add shared PageHeader component`
2. `refactor(nav): reorder menu items, add settings to mobile, rename to tmux tracker`
3. `refactor(pages): apply PageHeader to all pages for consistency`
