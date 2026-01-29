import { useNavigate } from 'react-router-dom'
import { useConnectionStatus } from '../hooks/useConnection'
import { CompetitionsPage } from '../components/CompetitionsPage'

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { connected, reconnectAttempt, forceReconnect } = useConnectionStatus()

  return (
    <CompetitionsPage
      connected={connected}
      reconnectAttempt={reconnectAttempt}
      onRetry={forceReconnect}
      onNavigateBack={() => navigate('/')}
      onNavigateToProject={(id) => navigate(`/projects/${id}`)}
    />
  )
}
