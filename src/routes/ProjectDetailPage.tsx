import { useParams, useNavigate } from 'react-router-dom'
import { useConnectionStatus } from '../hooks/useConnection'
import { ProjectDetailPage as ProjectDetailPageComponent } from '../components/ProjectDetailPage'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { connected } = useConnectionStatus()

  if (!id) {
    return (
      <div className="p-4 text-center">
        <p className="text-rpg-text-dim">Project not found</p>
      </div>
    )
  }

  return (
    <ProjectDetailPageComponent
      companionId={id}
      connected={connected}
      onNavigateBack={() => navigate('/projects')}
    />
  )
}
