import { useEffect } from 'react'
import { useStore } from '../store'
import { PageHeader } from '../components/PageHeader'
import { MoltbookFeed } from '../components/MoltbookFeed'
import { MoltbookHealth } from '../components/MoltbookHealth'
import { MoltbookRelationships } from '../components/MoltbookRelationships'
import { fetchMoltbookData } from '../lib/api'
import type {
  MoltbookActivityResponse,
  MoltbookHealthResponse,
  MoltbookRelationshipsResponse,
  MoltbookStateResponse,
} from '../types/moltbook'

/**
 * Moltbook page - dashboard for autonomous agent social activity
 *
 * Displays:
 * - Activity feed (posts, comments, engagements)
 * - Health metrics (orchestrator, agents, rate limits)
 * - Agent relationships (karma, collaboration potential)
 */
export default function MoltbookPage() {
  const setMoltbookActivity = useStore((state) => state.setMoltbookActivity)
  const setMoltbookHealth = useStore((state) => state.setMoltbookHealth)
  const setMoltbookRelationships = useStore((state) => state.setMoltbookRelationships)
  const setMoltbookOrchestratorState = useStore((state) => state.setMoltbookOrchestratorState)
  const setMoltbookLoading = useStore((state) => state.setMoltbookLoading)
  const setMoltbookError = useStore((state) => state.setMoltbookError)

  // Fetch initial data on mount
  useEffect(() => {
    setMoltbookLoading(true)
    setMoltbookError(null)

    Promise.all([
      fetchMoltbookData<MoltbookActivityResponse>('moltbook/activity', (data) => {
        if (data?.events) setMoltbookActivity(data.events)
      }),
      fetchMoltbookData<MoltbookHealthResponse>('moltbook/health', (data) => {
        if (data?.health) setMoltbookHealth(data.health)
      }),
      fetchMoltbookData<MoltbookRelationshipsResponse>('moltbook/relationships', (data) => {
        if (data?.relationships) setMoltbookRelationships(data.relationships)
      }),
      fetchMoltbookData<MoltbookStateResponse>('moltbook/state', (data) => {
        if (data?.state) setMoltbookOrchestratorState(data.state)
      }),
    ]).finally(() => {
      setMoltbookLoading(false)
    })
  }, [
    setMoltbookActivity,
    setMoltbookHealth,
    setMoltbookRelationships,
    setMoltbookOrchestratorState,
    setMoltbookLoading,
    setMoltbookError,
  ])

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Moltbook" />

      <div className="flex-1 overflow-y-auto p-4">
        {/* Desktop: 3-column grid, Mobile: stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Activity Feed */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated">
              <div className="px-4 py-3 border-b border-rpg-border">
                <h2 className="text-sm font-medium text-rpg-text">Activity Feed</h2>
              </div>
              <div className="p-2 max-h-[500px] overflow-y-auto">
                <MoltbookFeed maxItems={25} />
              </div>
            </div>
          </div>

          {/* Health Metrics */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated">
              <div className="px-4 py-3 border-b border-rpg-border">
                <h2 className="text-sm font-medium text-rpg-text">Health Metrics</h2>
              </div>
              <div className="p-4">
                <MoltbookHealth />
              </div>
            </div>
          </div>

          {/* Agent Relationships */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated">
              <div className="px-4 py-3 border-b border-rpg-border">
                <h2 className="text-sm font-medium text-rpg-text">Agent Relationships</h2>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto">
                <MoltbookRelationships />
              </div>
            </div>
          </div>
        </div>

        {/* External Links */}
        <div className="mt-4 flex items-center gap-4 text-xs text-rpg-text-dim">
          <a
            href="https://moltbook.com/u/WhoaBuddyClaude"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-rpg-accent transition-colors"
          >
            View Profile
          </a>
          <span>|</span>
          <a
            href="https://moltbook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-rpg-accent transition-colors"
          >
            Moltbook
          </a>
        </div>
      </div>
    </div>
  )
}
