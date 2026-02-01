# PLAN: Phase 5 - Dashboard Panel Cleanup

<plan>
  <goal>
    Clean up dashboard components: remove visual clutter, add useful features like interrupt and last prompt display, fix layout issues.
  </goal>

  <context>
    Issues to address:
    - #166: Remove chevrons, clean up icons, add interrupt, track last prompt
    - #164: Remove `/` prefix from search, remove keyboard shortcut text
    - #163: Show full cwd, fix 3-col grid, fix mobile layout

    Current state:
    - PaneCard shows various info but has visual clutter
    - Search/filter bar has legacy UI patterns
    - Worker cards may not show enough context
    - Grid layout may break on certain screen sizes

    Files to read:
    - src/components/PaneCard.tsx
    - src/components/OverviewDashboard.tsx
    - src/components/WorkerCard.tsx
  </context>

  <task id="1">
    <name>Clean up PaneCard visual elements</name>
    <files>src/components/PaneCard.tsx</files>
    <action>
      1. Remove chevron/expand icons that don't serve a purpose:
         - Find any `>` or chevron icons and remove or replace with meaningful actions

      2. Add interrupt button (Ctrl+C) for working/waiting panes:
         ```tsx
         {(status === 'working' || status === 'waiting') && (
           <button
             onClick={() => onSendSignal(pane.id, 'SIGINT')}
             className="p-1.5 text-rpg-error/70 hover:text-rpg-error hover:bg-rpg-error/10 rounded transition-colors"
             title="Interrupt (Ctrl+C)"
           >
             <StopCircleIcon className="w-4 h-4" />
           </button>
         )}
         ```

      3. Display last prompt (truncated) when available:
         ```tsx
         {session.lastPrompt && (
           <p className="text-xs text-rpg-text-dim mt-1 truncate">
             <span className="text-rpg-text-muted">Last:</span> {session.lastPrompt}
           </p>
         )}
         ```

      4. Clean up icon usage:
         - Use consistent icon library (Heroicons or similar)
         - Remove decorative icons that add noise
         - Keep functional icons (status, actions)

      5. Simplify the card structure:
         - Avatar + name + status in header row
         - Current activity/tool in body
         - Actions in footer (if needed)
    </action>
    <verify>
      1. Open dashboard with active Claude sessions
      2. Verify no stray chevrons or expand icons
      3. Verify interrupt button appears for working panes
      4. Verify clicking interrupt sends SIGINT
      5. Verify last prompt displays when available
      6. Overall visual cleaner and less cluttered
    </verify>
    <done>PaneCard is visually cleaner with interrupt button and last prompt</done>
  </task>

  <task id="2">
    <name>Fix search/filter bar</name>
    <files>src/components/OverviewDashboard.tsx, src/components/FilterBar.tsx (if exists)</files>
    <action>
      1. Find the search/filter input in OverviewDashboard or related component

      2. Remove `/` prefix from placeholder:
         ```tsx
         // Before: placeholder="/search..."
         // After:
         placeholder="Search windows..."
         ```

      3. Remove keyboard shortcut text (like "Press / to search"):
         - Users can discover shortcuts organically
         - Reduces visual noise

      4. Keep the search functional:
         - Filter by window name
         - Filter by pane content
         - Filter by status

      5. Style the search input cleanly:
         ```tsx
         <input
           type="text"
           placeholder="Search windows..."
           value={filter}
           onChange={e => setFilter(e.target.value)}
           className="w-full px-3 py-2 bg-rpg-card border border-rpg-border rounded-lg
                      text-sm text-rpg-text placeholder-rpg-text-dim
                      focus:outline-none focus:border-rpg-accent"
         />
         ```
    </action>
    <verify>
      1. Open dashboard
      2. Verify search placeholder says "Search windows..." (no /)
      3. Verify no keyboard shortcut hint text visible
      4. Verify search still filters correctly
      5. Verify visual style matches rest of UI
    </verify>
    <done>Search bar cleaned up without / prefix or shortcut hints</done>
  </task>

  <task id="3">
    <name>Fix WorkerCard and grid layout</name>
    <files>src/components/WorkerCard.tsx, src/components/OverviewDashboard.tsx</files>
    <action>
      1. In WorkerCard, show full cwd path:
         ```tsx
         // Before: might truncate or show only basename
         // After: show full path with horizontal scroll or tooltip
         <p className="text-xs text-rpg-text-dim font-mono truncate" title={worker.cwd}>
           {worker.cwd}
         </p>
         ```

      2. Fix grid layout for proper 3-column on desktop:
         ```tsx
         // In OverviewDashboard or container:
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {windows.map(window => (
             <WindowCard key={window.id} window={window} />
           ))}
         </div>
         ```

      3. Fix mobile layout issues:
         - Cards should be full-width on mobile (< 640px)
         - 2 columns on tablet (640px - 1024px)
         - 3 columns on desktop (> 1024px)
         - Proper padding and gaps at all sizes

      4. Ensure cards don't overflow:
         ```css
         .card {
           min-width: 0; /* Allow flex items to shrink */
           overflow: hidden;
         }
         ```

      5. Handle empty states gracefully:
         ```tsx
         {windows.length === 0 && (
           <div className="col-span-full text-center py-8 text-rpg-text-dim">
             No tmux windows found. Start a tmux session to begin.
           </div>
         )}
         ```
    </action>
    <verify>
      1. Test on mobile viewport (< 640px): cards full width
      2. Test on tablet viewport (640-1024px): 2 column grid
      3. Test on desktop viewport (> 1024px): 3 column grid
      4. Verify cwd shows full path (with truncation/tooltip)
      5. Verify no horizontal overflow on any viewport
      6. Test with 1, 2, 3, 4, 6 windows to verify grid behavior
    </verify>
    <done>WorkerCard shows full cwd; grid layout works at all breakpoints</done>
  </task>
</plan>

## Files Summary

**Read first:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/OverviewDashboard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/WorkerCard.tsx`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/OverviewDashboard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/WorkerCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/styles/main.css` (if needed)

## Commits

1. `fix(ui): clean up PaneCard, add interrupt button, show last prompt`
2. `fix(ui): remove search bar / prefix and keyboard shortcut hints`
3. `fix(ui): fix grid layout and show full cwd in WorkerCard`
