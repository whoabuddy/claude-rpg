import { useMemo } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { LayoutGrid, Settings } from 'lucide-react'
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
        {/* Mobile header bar - game HUD style */}
        <header className="sm:hidden flex items-center justify-between px-3 py-2 border-b border-rpg-border bg-rpg-bg-elevated">
          {/* Left: Title */}
          <NavLink to="/" className="font-bold text-lg text-rpg-text">
            claude-rpg
          </NavLink>

          {/* Center: Status summary - like a resource bar */}
          <div className="flex items-center gap-2">
            {attentionCount > 0 ? (
              <div className="px-3 py-1.5 rounded-lg bg-rpg-waiting/20 text-rpg-waiting font-semibold animate-pulse min-w-[48px] text-center">
                {attentionCount}
              </div>
            ) : (
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-rpg-success' : 'bg-rpg-error animate-pulse'}`} />
            )}
            {!connected && (
              <button
                onClick={forceReconnect}
                className="px-2 py-1 text-sm text-rpg-accent bg-rpg-accent/10 rounded"
              >
                Retry
              </button>
            )}
          </div>

          {/* Right: Settings - larger tap target */}
          <NavLink
            to="/settings"
            className="p-2.5 text-rpg-text-muted hover:text-rpg-text hover:bg-rpg-card rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-6 h-6" />
          </NavLink>
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

// Icon components for navigation
const NAV_ICONS: Record<IconName, React.FC<{ className?: string }>> = {
  grid: LayoutGrid,
  settings: Settings,
}

function NavIcon({ icon }: { icon: IconName }) {
  const IconComponent = NAV_ICONS[icon]
  return <IconComponent className="w-5 h-5" />
}
