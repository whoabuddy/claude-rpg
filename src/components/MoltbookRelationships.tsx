import { useMemo, useState } from 'react'
import { Users, Star, Wallet, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { useMoltbookRelationships } from '../store'
import type { Agent } from '../types/moltbook'

const POTENTIAL_COLORS: Record<Agent['collaboration_potential'], string> = {
  high: 'text-rpg-success bg-rpg-success/10',
  medium: 'text-rpg-waiting bg-rpg-waiting/10',
  low: 'text-rpg-text-dim bg-rpg-text-dim/10',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

interface AgentCardProps {
  agent: Agent
}

function AgentCard({ agent }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-rpg-border/50 bg-rpg-card overflow-hidden">
      <div
        className="p-3 cursor-pointer hover:bg-rpg-card-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rpg-border flex items-center justify-center text-sm font-medium">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-rpg-text">{agent.name}</span>
                {agent.bns_name && (
                  <span className="text-xs text-rpg-accent">{agent.bns_name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-rpg-text-dim">
                <span>Since {formatDate(agent.first_seen)}</span>
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3" />
                  {agent.karma}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${POTENTIAL_COLORS[agent.collaboration_potential]}`}>
              {agent.collaboration_potential}
            </span>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-rpg-text-dim" />
            ) : (
              <ChevronRight className="w-4 h-4 text-rpg-text-dim" />
            )}
          </div>
        </div>

        {/* Domain overlap badges */}
        {agent.domain_overlap.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {agent.domain_overlap.map(domain => (
              <span
                key={domain}
                className="text-xs px-1.5 py-0.5 rounded bg-rpg-border text-rpg-text-muted"
              >
                {domain}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-rpg-border/30 mt-1 pt-2 space-y-3">
          {/* Wallet info */}
          {agent.has_stacks_wallet && (
            <div className="flex items-center gap-2 text-xs">
              <Wallet className="w-3.5 h-3.5 text-rpg-accent" />
              <span className="text-rpg-text-muted">
                {agent.stacks_address
                  ? `${agent.stacks_address.slice(0, 8)}...${agent.stacks_address.slice(-6)}`
                  : 'Has wallet'}
              </span>
            </div>
          )}

          {/* Notes */}
          {agent.notes && (
            <div className="text-xs text-rpg-text-muted">
              <div className="font-medium mb-1">Notes:</div>
              <p className="text-rpg-text-dim">{agent.notes}</p>
            </div>
          )}

          {/* Recent interactions */}
          {agent.interactions.length > 0 && (
            <div className="text-xs">
              <div className="font-medium text-rpg-text-muted mb-1">
                Recent Interactions ({agent.interactions.length})
              </div>
              <div className="space-y-1">
                {agent.interactions.slice(0, 3).map((interaction, i) => (
                  <div key={i} className="flex items-center gap-2 text-rpg-text-dim">
                    <span className="text-rpg-text-muted">{formatDate(interaction.date)}</span>
                    <span>{interaction.type}</span>
                    {interaction.context && (
                      <span className="truncate flex-1">{interaction.context}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link to Moltbook profile */}
          <a
            href={`https://moltbook.com/u/${agent.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-rpg-accent hover:text-rpg-accent-bright transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            View profile <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}

type SortField = 'karma' | 'first_seen' | 'potential'

export function MoltbookRelationships() {
  const relationships = useMoltbookRelationships()
  const [sortBy, setSortBy] = useState<SortField>('karma')

  const sortedAgents = useMemo(() => {
    if (!relationships?.agents) return []

    return [...relationships.agents].sort((a, b) => {
      switch (sortBy) {
        case 'karma':
          return b.karma - a.karma
        case 'first_seen':
          return new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime()
        case 'potential':
          const order = { high: 0, medium: 1, low: 2 }
          return order[a.collaboration_potential] - order[b.collaboration_potential]
        default:
          return 0
      }
    })
  }, [relationships, sortBy])

  if (!relationships || relationships.agents.length === 0) {
    return (
      <div className="p-4 text-center text-rpg-text-dim">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No agent relationships yet</p>
        <p className="text-xs mt-1">Relationships will appear as you interact with agents</p>
      </div>
    )
  }

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-rpg-text-muted">
          {relationships.agents.length} agents
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          className="text-xs bg-rpg-card border border-rpg-border rounded px-2 py-1 text-rpg-text"
        >
          <option value="karma">By Karma</option>
          <option value="first_seen">By Recent</option>
          <option value="potential">By Potential</option>
        </select>
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {sortedAgents.map(agent => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>

      {/* Last updated */}
      <div className="mt-3 text-xs text-rpg-text-dim text-center">
        Last updated: {formatDate(relationships.last_updated)}
      </div>
    </div>
  )
}
