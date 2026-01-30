import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useConnection } from './hooks/useConnection'
import { Layout } from './components/Layout'

// Lazy load route components for code splitting
const DashboardPage = lazy(() => import('./routes/DashboardPage'))
const ProjectDetailPage = lazy(() => import('./routes/ProjectDetailPage'))
const QuestsPage = lazy(() => import('./routes/QuestsPage'))
const LeaderboardPage = lazy(() => import('./routes/LeaderboardPage'))
const SettingsPage = lazy(() => import('./routes/SettingsPage'))
const TranscribePage = lazy(() => import('./routes/TranscribePage'))
const ScratchpadPage = lazy(() => import('./routes/ScratchpadPage'))
const NotFoundPage = lazy(() => import('./routes/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rpg-accent"></div>
    </div>
  )
}

export default function App() {
  // Initialize WebSocket connection at app root
  useConnection()

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="quests" element={<QuestsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="transcribe" element={<TranscribePage />} />
            <Route path="scratchpad" element={<ScratchpadPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
