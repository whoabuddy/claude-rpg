import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useConnection } from './hooks/useConnection'
import { Layout } from './components/Layout'

// Lazy load route components
const DashboardPage = lazy(() => import('./routes/DashboardPage'))
const PersonasPage = lazy(() => import('./routes/PersonasPage'))
const ProjectsPage = lazy(() => import('./routes/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('./routes/ProjectDetailPage'))
const QuestsPage = lazy(() => import('./routes/QuestsPage'))
const LeaderboardPage = lazy(() => import('./routes/LeaderboardPage'))
const SettingsPage = lazy(() => import('./routes/SettingsPage'))
const NotFoundPage = lazy(() => import('./routes/NotFoundPage'))

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin w-8 h-8 border-2 border-rpg-accent border-t-transparent rounded-full" />
    </div>
  )
}

// Helper to reduce Suspense boilerplate
function LazyRoute({ component: Component }: { component: LazyExoticComponent<ComponentType<unknown>> }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

export default function App() {
  // Initialize WebSocket connection at app root
  useConnection()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LazyRoute component={DashboardPage} />} />
          <Route path="personas" element={<LazyRoute component={PersonasPage} />} />
          <Route path="projects" element={<LazyRoute component={ProjectsPage} />} />
          <Route path="projects/:id" element={<LazyRoute component={ProjectDetailPage} />} />
          <Route path="quests" element={<LazyRoute component={QuestsPage} />} />
          <Route path="leaderboard" element={<LazyRoute component={LeaderboardPage} />} />
          <Route path="settings" element={<LazyRoute component={SettingsPage} />} />
          <Route path="*" element={<LazyRoute component={NotFoundPage} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
