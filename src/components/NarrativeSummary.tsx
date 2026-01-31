import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { NarrativeSummary } from '../types/project'

interface NarrativeSummaryProps {
  narrative: NarrativeSummary | null
  loading: boolean
  onExport: () => void
}

export function NarrativeSummary({ narrative, loading, onExport }: NarrativeSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['team']))

  if (loading) {
    return (
      <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-3">Project Story</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-rpg-text-dim">Generating narrative...</div>
        </div>
      </div>
    )
  }

  if (!narrative) {
    return (
      <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-3">Project Story</h2>
        <div className="text-sm text-rpg-text-dim">No narrative available yet.</div>
      </div>
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const sections = [
    { id: 'team', title: 'The Team', content: narrative.teamSection },
    { id: 'activity', title: 'The Work', content: narrative.activitySection },
    { id: 'milestones', title: 'Milestones', content: narrative.milestonesSection },
  ]

  return (
    <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-rpg-text">{narrative.title}</h2>
        <p className="text-sm text-rpg-text-muted italic">{narrative.tagline}</p>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-3 mb-4">
        {sections.map(section => {
          const isExpanded = expandedSections.has(section.id)
          return (
            <div key={section.id} className="border border-rpg-border-dim rounded">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-rpg-card transition-colors"
              >
                <span className="text-sm font-medium text-rpg-text">{section.title}</span>
                <ChevronDown
                  className={`w-4 h-4 text-rpg-text-muted transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {section.content.map((paragraph, idx) => (
                    <p key={idx} className="text-sm text-rpg-text-muted leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Export Button */}
      <button
        onClick={onExport}
        className="w-full px-4 py-2 bg-rpg-accent/20 hover:bg-rpg-accent/30 text-rpg-accent border border-rpg-accent/50 rounded transition-colors text-sm font-medium"
      >
        Export as Markdown
      </button>
    </div>
  )
}
