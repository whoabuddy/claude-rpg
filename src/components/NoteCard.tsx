import { useState } from 'react'
import type { Note, NoteStatus } from '../../shared/types'

interface NoteCardProps {
  note: Note
  onStatusChange: (id: string, status: NoteStatus) => void
  onDelete: (id: string) => void
  onCreateIssue?: (note: Note) => void
}

// Status badge styling - defined at module level to avoid recreation
const STATUS_STYLES: Record<NoteStatus, { bg: string; text: string; label: string }> = {
  inbox: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Inbox' },
  triaged: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Triaged' },
  archived: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Archived' },
  converted: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Converted to Issue' },
}

// Format relative date - pure function at module level
function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

/**
 * NoteCard displays a single note with status-based actions
 */
export function NoteCard({ note, onStatusChange, onDelete, onCreateIssue }: NoteCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (newStatus: NoteStatus) => {
    setIsUpdating(true)
    try {
      await onStatusChange(note.id, newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    setIsUpdating(true)
    try {
      await onDelete(note.id)
    } finally {
      setIsUpdating(false)
    }
  }

  const currentStatus = STATUS_STYLES[note.status]

  return (
    <div className="p-4 rounded-lg border border-rpg-border bg-rpg-card hover:border-rpg-accent/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-rpg-text-muted">
            {formatDate(note.createdAt)}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded ${currentStatus.bg} ${currentStatus.text}`}>
            {currentStatus.label}
          </span>
        </div>
        {note.status !== 'converted' && (
          <button
            onClick={handleDelete}
            disabled={isUpdating}
            className="px-2 py-1 text-xs text-rpg-error hover:bg-rpg-error/10 rounded transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-rpg-text whitespace-pre-wrap break-words mb-3">
        {note.content}
      </p>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {note.tags.map((tag) => {
            // Render issue URLs as clickable links
            if (tag.startsWith('issue:')) {
              const url = tag.slice(6)
              return (
                <a
                  key={tag}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded underline"
                >
                  GitHub Issue
                </a>
              )
            }
            return (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-rpg-accent/20 text-rpg-accent rounded"
              >
                {tag}
              </span>
            )
          })}
        </div>
      )}

      {/* Actions - status-dependent */}
      {note.status !== 'converted' && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-rpg-border">
          {note.status === 'inbox' && (
            <>
              <button
                onClick={() => handleStatusChange('archived')}
                disabled={isUpdating}
                className="px-3 py-1.5 text-xs bg-rpg-card-hover text-rpg-text-muted hover:bg-rpg-border rounded transition-colors disabled:opacity-50"
              >
                Archive
              </button>
              <button
                onClick={() => handleStatusChange('triaged')}
                disabled={isUpdating}
                className="px-3 py-1.5 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded transition-colors disabled:opacity-50"
              >
                Mark Triaged
              </button>
              <button
                onClick={() => onCreateIssue?.(note)}
                disabled={isUpdating}
                className="px-3 py-1.5 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors disabled:opacity-50"
              >
                Create Issue
              </button>
            </>
          )}

          {note.status === 'triaged' && (
            <>
              <button
                onClick={() => handleStatusChange('archived')}
                disabled={isUpdating}
                className="px-3 py-1.5 text-xs bg-rpg-card-hover text-rpg-text-muted hover:bg-rpg-border rounded transition-colors disabled:opacity-50"
              >
                Archive
              </button>
              <button
                onClick={() => onCreateIssue?.(note)}
                disabled={isUpdating}
                className="px-3 py-1.5 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors disabled:opacity-50"
              >
                Create Issue
              </button>
            </>
          )}

          {note.status === 'archived' && (
            <button
              onClick={() => handleStatusChange('inbox')}
              disabled={isUpdating}
              className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded transition-colors disabled:opacity-50"
            >
              Restore to Inbox
            </button>
          )}
        </div>
      )}
    </div>
  )
}
