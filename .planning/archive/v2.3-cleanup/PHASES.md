# Phases

## Phase 1: Fix UI text and meta tags
Goal: Correct the quest command instruction and update deprecated meta tags
Status: `completed`

Tasks:
- Update QuestsPage.tsx: change `/quest "Goal"` to `/quest-create "Goal"`
- Review index.html meta tags - keep apple-mobile-web-app-capable (iOS), add mobile-web-app-capable (Android) if missing

## Phase 2: Implement competition period filtering
Goal: Make competition leaderboards filter by time period (today, week, all) using xp_events table
Status: `completed`

Tasks:
- Add date range calculation helpers for 'today' (start of day UTC) and 'week' (7 days ago)
- Create database query to sum XP by project within a date range from xp_events table
- Update getCategoryValue() to query xp_events for 'today' and 'week' periods, keeping 'all' as current behavior
- Test that leaderboards show different rankings for different time periods

## Phase 3: Visual verification
Goal: Verify Projects page and Personas display work correctly without errors
Status: `completed`

Tasks:
- Test ProjectDetailPage (/projects/:id) - verify it loads, commits/sessions populate, no 404 errors
- Test Dashboard persona display - verify energy/morale meters render, status values are accurate
- Document any issues found for future fixes
