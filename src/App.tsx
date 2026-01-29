// Diagnostic version - no lazy loading to test if that's the issue
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useConnection } from './hooks/useConnection'
import { Layout } from './components/Layout'

// Direct imports instead of lazy()
import DashboardPage from './routes/DashboardPage'
import PersonasPage from './routes/PersonasPage'
import ProjectsPage from './routes/ProjectsPage'
import ProjectDetailPage from './routes/ProjectDetailPage'
import QuestsPage from './routes/QuestsPage'
import LeaderboardPage from './routes/LeaderboardPage'
import SettingsPage from './routes/SettingsPage'
import TranscribePage from './routes/TranscribePage'
import NotFoundPage from './routes/NotFoundPage'

export default function App() {
  // Initialize WebSocket connection at app root
  useConnection()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="quests" element={<QuestsPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="transcribe" element={<TranscribePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
