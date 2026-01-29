import { useNavigate } from 'react-router-dom'
import { useConnectionStatus } from '../hooks/useConnection'
import { QuestsPage as QuestsPageComponent } from '../components/QuestsPage'

export default function QuestsPage() {
  const navigate = useNavigate()
  const { connected } = useConnectionStatus()

  return (
    <QuestsPageComponent
      connected={connected}
      onNavigateBack={() => navigate('/')}
    />
  )
}
