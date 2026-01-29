import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useConnectionStatus } from '../hooks/useConnection'
import { ToastContainer } from './ToastContainer'

/**
 * Main application layout with navigation
 */
export function Layout() {
  const { connected, reconnectAttempt, forceReconnect } = useConnectionStatus()
  const attentionCount = useStore((state) =>
    state.windows.flatMap(w => w.panes).filter(p =>
      p.process.type === 'claude' &&
      (p.process.claudeSession?.status === 'waiting' || p.process.claudeSession?.status === 'error')
    ).length
  )
  const location = useLocation()

  // Hide nav on fullscreen pane view
  const isFullscreen = location.pathname.startsWith('/pane/')

  return (
    <div className="h-full flex flex-col bg-rpg-bg">
      {/* Disconnected banner */}
      {!connected && (
        <div className="px-4 py-2 bg-rpg-error/20 border-b border-rpg-error/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rpg-error animate-pulse" />
            <span className="text-sm text-rpg-error">
              Disconnected
              {reconnectAttempt > 0 && ` (retry ${reconnectAttempt})`}
            </span>
          </div>
          <button
            onClick={forceReconnect}
            className="px-3 py-1 text-xs bg-rpg-error/20 hover:bg-rpg-error/30 text-rpg-error rounded transition-colors"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Main content */}
      <main className={`flex-1 overflow-y-auto ${!isFullscreen ? 'pb-[52px] sm:pb-0' : ''}`}>
        <Outlet />
      </main>

      {/* Bottom navigation - mobile */}
      {!isFullscreen && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-rpg-card border-t border-rpg-border">
          <div className="flex justify-around">
            <NavItem to="/" icon="grid" label="Dashboard" />
            <NavItem to="/personas" icon="users" label="Personas" />
            <NavItem to="/projects" icon="folder" label="Projects" badge={attentionCount} />
            <NavItem to="/quests" icon="scroll" label="Quests" />
            <NavItem to="/leaderboard" icon="trophy" label="Leaders" />
          </div>
        </nav>
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}

interface NavItemProps {
  to: string
  icon: 'grid' | 'users' | 'folder' | 'scroll' | 'trophy' | 'settings'
  label: string
  badge?: number
}

function NavItem({ to, icon, label, badge }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
          isActive ? 'text-rpg-accent' : 'text-rpg-text-muted hover:text-rpg-text'
        }`
      }
    >
      <NavIcon icon={icon} />
      <span className="mt-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-rpg-waiting text-rpg-bg rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  )
}

function NavIcon({ icon }: { icon: NavItemProps['icon'] }) {
  const className = "w-5 h-5"

  switch (icon) {
    case 'grid':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    case 'users':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m0 0V10a3 3 0 116 0v4.5" />
        </svg>
      )
    case 'folder':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    case 'scroll':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'trophy':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      )
    case 'settings':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
  }
}
