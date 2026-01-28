import { useWorkers } from '../hooks/useWorkers'
import { WorkerCard } from './WorkerCard'
import { ConnectionBanner, ConnectionDot } from './ConnectionStatus'

interface WorkersPageProps {
  connected: boolean
  reconnectAttempt?: number
  onRetry?: () => void
  onNavigateBack: () => void
}

export function WorkersPage({ connected, reconnectAttempt, onRetry, onNavigateBack }: WorkersPageProps) {
  const { workers, loading } = useWorkers()

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="p-2 -ml-2 text-rpg-text-muted hover:text-rpg-text transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium text-rpg-text">Workers</h1>
        </div>
        <ConnectionDot connected={connected} />
      </div>

      {/* Connection banner */}
      <ConnectionBanner connected={connected} reconnectAttempt={reconnectAttempt} onRetry={onRetry} />

      {/* Main content - dimmed when disconnected */}
      <div className={!connected ? 'opacity-60 pointer-events-none' : undefined}>
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-rpg-accent border-t-transparent rounded-full" />
          </div>
        )}

        {/* Workers grid */}
        {!loading && workers.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {workers.map(worker => (
              <WorkerCard key={worker.id} worker={worker} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && workers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-rpg-text-muted">
            <p className="text-lg mb-2">No workers found</p>
            <p className="text-sm text-rpg-text-dim">Start a Claude Code session to see workers here</p>
          </div>
        )}
      </div>
    </div>
  )
}
