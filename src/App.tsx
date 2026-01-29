import { lazy, Suspense } from 'react'
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

export default function App() {
  // Initialize WebSocket connection at app root
  useConnection()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="personas"
            element={
              <Suspense fallback={<PageLoader />}>
                <PersonasPage />
              </Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectsPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectDetailPage />
              </Suspense>
            }
          />
          <Route
            path="quests"
            element={
              <Suspense fallback={<PageLoader />}>
                <QuestsPage />
              </Suspense>
            }
          />
          <Route
            path="leaderboard"
            element={
              <Suspense fallback={<PageLoader />}>
                <LeaderboardPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <Suspense fallback={<PageLoader />}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
