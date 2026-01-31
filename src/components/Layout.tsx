import { useMemo } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useConnectionStatus } from '../hooks/useConnection'
import { ToastContainer } from './ToastContainer'

/**
 * Main application layout with simplified navigation
 *
 * Phase 3: Single-screen UI
 * - Mobile: No bottom nav - all content accessible via panels on dashboard
 * - Desktop: Simplified sidebar with Home and Settings only
 */
export function Layout() {
  const { connected, reconnectAttempt, forceReconnect } = useConnectionStatus()
  const windows = useStore((state) => state.windows)

  // Derive attentionCount using useMemo to avoid infinite loop
  const attentionCount = useMemo(() =>
    windows.flatMap(w => w.panes).filter(p =>
      p.process.type === 'claude' &&
      (p.process.claudeSession?.status === 'waiting' || p.process.claudeSession?.status === 'error')
    ).length,
    [windows]
  )

  const location = useLocation()

  // Hide nav on fullscreen pane view
  const isFullscreen = location.pathname.startsWith('/pane/')

  return (
    <div className="h-full flex flex-col sm:flex-row bg-rpg-bg">
      {/* Desktop sidebar - simplified to Home and Settings */}
      {!isFullscreen && (
        <aside className="hidden sm:flex flex-col w-56 border-r border-rpg-border bg-rpg-bg-elevated">
          {/* Logo/branding */}
          <div className="p-4 border-b border-rpg-border">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rpg-accent to-rpg-accent-dim flex items-center justify-center">
                <span className="text-lg">C</span>
              </div>
              <div>
                <h1 className="font-bold text-rpg-text leading-tight">claude-rpg</h1>
                <p className="text-[10px] text-rpg-text-dim tracking-wide">TMUX TRACKER</p>
              </div>
            </NavLink>
          </div>

          {/* Navigation links - simplified */}
          <nav className="flex-1 p-2 space-y-1">
            <SidebarItem to="/" icon="grid" label="Dashboard" end badge={attentionCount} />
          </nav>

          {/* Settings at bottom */}
          <div className="p-2 border-t border-rpg-border">
            <SidebarItem to="/settings" icon="settings" label="Settings" />
          </div>

          {/* Connection status */}
          <div className="p-3 border-t border-rpg-border">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-rpg-success' : 'bg-rpg-error animate-pulse'}`} />
              <span className="text-xs text-rpg-text-dim">
                {connected ? 'Connected' : `Disconnected${reconnectAttempt > 0 ? ` (${reconnectAttempt})` : ''}`}
              </span>
              {!connected && (
                <button
                  onClick={forceReconnect}
                  className="ml-auto text-xs text-rpg-accent hover:text-rpg-accent-bright transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile header bar with status */}
        <header className="sm:hidden flex items-center justify-between px-4 py-2 border-b border-rpg-border bg-rpg-bg-elevated">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="font-bold text-rpg-text">claude-rpg</span>
            {attentionCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rpg-waiting/20 text-rpg-waiting text-xs font-medium animate-pulse">
                {attentionCount}
              </span>
            )}
          </NavLink>
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-rpg-success' : 'bg-rpg-error animate-pulse'}`} />
              {!connected && (
                <button
                  onClick={forceReconnect}
                  className="text-xs text-rpg-accent"
                >
                  Retry
                </button>
              )}
            </div>
            {/* Settings link */}
            <NavLink
              to="/settings"
              className="p-2 text-rpg-text-muted hover:text-rpg-text rounded-lg transition-colors"
              aria-label="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </NavLink>
          </div>
        </header>

        {/* Main content - no bottom padding since no bottom nav */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}

// Desktop sidebar item
interface SidebarItemProps {
  to: string
  icon: IconName
  label: string
  badge?: number
  end?: boolean
}

function SidebarItem({ to, icon, label, badge, end }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
          isActive
            ? 'bg-rpg-accent/15 text-rpg-accent font-medium'
            : 'text-rpg-text-muted hover:bg-rpg-card hover:text-rpg-text'
        }`
      }
    >
      <NavIcon icon={icon} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 text-xs font-bold bg-rpg-waiting text-rpg-bg rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  )
}

type IconName = 'grid' | 'settings'

// Icon paths for navigation
const ICON_PATHS: Record<IconName, string | string[]> = {
  grid: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  settings: [
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
  ],
}

function NavIcon({ icon }: { icon: IconName }) {
  const paths = ICON_PATHS[icon]
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {Array.isArray(paths)
        ? paths.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />)
        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths} />
      }
    </svg>
  )
}
