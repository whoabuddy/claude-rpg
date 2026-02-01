# PLAN: Phase 8 - Activity Pulse Feature

<plan>
  <goal>
    Add visual heartbeat/pulse animation to panes that shows recent activity from Claude Code hooks, providing at-a-glance feedback on which sessions are actively processing.
  </goal>

  <context>
    Issue #178: Activity pulse - visual heartbeat from hooks

    Concept:
    - Each hook event creates a "pulse" on the relevant pane
    - Pulse intensity fades over time (recent = bright, older = dim)
    - Provides instant visual feedback without reading status text
    - Different colors for different event types (tool = blue, error = red)

    Implementation approach:
    - Track lastEventTimestamp per pane
    - CSS animation triggered on timestamp change
    - Fade from full opacity to 0 over ~2 seconds
    - Ring or glow effect around avatar or card border

    Files to read:
    - src/components/PaneCard.tsx
    - src/lib/websocket.ts (event handling)
    - src/store/index.ts (event state)
  </context>

  <task id="1">
    <name>Track activity timestamps in store</name>
    <files>src/store/index.ts, src/lib/websocket.ts</files>
    <action>
      1. Add activity tracking to store:
         ```typescript
         interface StoreState {
           // ... existing state
           paneActivity: Record<string, {
             timestamp: number
             type: 'tool' | 'prompt' | 'stop' | 'error'
           }>
           recordPaneActivity: (paneId: string, type: string) => void
         }
         ```

      2. Implement recordPaneActivity:
         ```typescript
         recordPaneActivity: (paneId, type) => {
           set(state => ({
             paneActivity: {
               ...state.paneActivity,
               [paneId]: {
                 timestamp: Date.now(),
                 type: type as 'tool' | 'prompt' | 'stop' | 'error',
               },
             },
           }))
         }
         ```

      3. In websocket.ts, call recordPaneActivity on events:
         ```typescript
         case 'event':
           const event = message.payload
           // Find pane for this event (via sessionId or cwd matching)
           const paneId = findPaneIdForEvent(event)
           if (paneId) {
             const activityType = event.type.includes('tool') ? 'tool'
               : event.type === 'user_prompt_submit' ? 'prompt'
               : event.type === 'stop' ? 'stop'
               : 'tool'
             store.recordPaneActivity(paneId, activityType)
           }
           // ... existing event handling
           break
         ```

      4. Add selector for pane activity:
         ```typescript
         export const usePaneActivity = (paneId: string) =>
           useStore(state => state.paneActivity[paneId])
         ```
    </action>
    <verify>
      1. Open React DevTools
      2. Trigger a tool use in Claude
      3. Verify paneActivity state updates with timestamp
      4. Verify different event types are captured
    </verify>
    <done>Activity timestamps tracked in store per pane</done>
  </task>

  <task id="2">
    <name>Create ActivityPulse component</name>
    <files>src/components/ActivityPulse.tsx (new), src/styles/main.css</files>
    <action>
      1. Create ActivityPulse.tsx:
         ```tsx
         interface ActivityPulseProps {
           activity?: { timestamp: number; type: 'tool' | 'prompt' | 'stop' | 'error' }
           className?: string
         }

         export function ActivityPulse({ activity, className }: ActivityPulseProps) {
           const [pulseKey, setPulseKey] = useState(0)

           // Trigger new animation on timestamp change
           useEffect(() => {
             if (activity?.timestamp) {
               setPulseKey(prev => prev + 1)
             }
           }, [activity?.timestamp])

           if (!activity) return null

           // Don't show if activity is older than 3 seconds
           const age = Date.now() - activity.timestamp
           if (age > 3000) return null

           const colorClass = {
             tool: 'bg-rpg-working',
             prompt: 'bg-rpg-accent',
             stop: 'bg-rpg-idle',
             error: 'bg-rpg-error',
           }[activity.type]

           return (
             <span
               key={pulseKey}
               className={`absolute inset-0 rounded-full ${colorClass} animate-pulse-ring ${className}`}
             />
           )
         }
         ```

      2. Add CSS animation in main.css:
         ```css
         @keyframes pulse-ring {
           0% {
             opacity: 0.8;
             transform: scale(1);
           }
           100% {
             opacity: 0;
             transform: scale(1.5);
           }
         }

         .animate-pulse-ring {
           animation: pulse-ring 1.5s ease-out forwards;
           pointer-events: none;
         }
         ```

      3. Alternative: glow effect instead of ring:
         ```css
         @keyframes pulse-glow {
           0% {
             box-shadow: 0 0 0 0 currentColor;
             opacity: 0.7;
           }
           100% {
             box-shadow: 0 0 0 8px currentColor;
             opacity: 0;
           }
         }

         .animate-pulse-glow {
           animation: pulse-glow 1s ease-out forwards;
         }
         ```
    </action>
    <verify>
      1. Import and render ActivityPulse in isolation
      2. Pass mock activity data
      3. Verify animation plays
      4. Verify animation doesn't play for old timestamps
      5. Verify colors match event types
    </verify>
    <done>ActivityPulse component with CSS animations</done>
  </task>

  <task id="3">
    <name>Integrate pulse into PaneCard</name>
    <files>src/components/PaneCard.tsx, src/components/PaneAvatar.tsx</files>
    <action>
      1. In PaneCard, get activity and pass to avatar:
         ```tsx
         function PaneCard({ pane }: PaneCardProps) {
           const activity = usePaneActivity(pane.id)

           return (
             <div className="relative ...">
               <PaneAvatar pane={pane} activity={activity} />
               {/* ... rest of card */}
             </div>
           )
         }
         ```

      2. In PaneAvatar, render pulse ring:
         ```tsx
         interface PaneAvatarProps {
           pane: TmuxPane
           size?: 'sm' | 'md' | 'lg'
           activity?: { timestamp: number; type: string }
         }

         export function PaneAvatar({ pane, size = 'md', activity }: PaneAvatarProps) {
           const sizeClasses = {
             sm: 'w-8 h-8',
             md: 'w-10 h-10',
             lg: 'w-12 h-12',
           }

           return (
             <div className={`relative ${sizeClasses[size]}`}>
               {/* Activity pulse (behind avatar) */}
               <ActivityPulse
                 activity={activity}
                 className="absolute inset-0"
               />

               {/* Avatar */}
               <div className="relative rounded-full overflow-hidden bg-rpg-card border border-rpg-border">
                 {/* ... avatar content */}
               </div>
             </div>
           )
         }
         ```

      3. Test with multiple panes to ensure isolation:
         - Pulse on pane A shouldn't affect pane B
         - Multiple rapid events should re-trigger animation
    </action>
    <verify>
      1. Open dashboard with Claude panes visible
      2. Trigger a tool use in one pane
      3. Verify pulse animation appears around that pane's avatar
      4. Verify other panes don't pulse
      5. Trigger error - verify red pulse
      6. Verify pulse fades after ~1.5s
    </verify>
    <done>Activity pulse integrated into PaneCard avatars</done>
  </task>
</plan>

## Files Summary

**Create:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/ActivityPulse.tsx`

**Modify:**
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/store/index.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/lib/websocket.ts`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneCard.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/components/PaneAvatar.tsx`
- `/home/whoabuddy/dev/whoabuddy/claude-rpg/src/styles/main.css`

## Commits

1. `feat(store): track pane activity timestamps`
2. `feat(ui): add ActivityPulse component with ring animation`
3. `feat(ui): integrate activity pulse into PaneCard avatars`
