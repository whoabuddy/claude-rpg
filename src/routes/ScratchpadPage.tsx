import { useState, useEffect, useCallback } from 'react'
import { VoiceButton } from '../components/VoiceButton'

type NoteStatus = 'inbox' | 'triaged' | 'archived'

interface Note {
  id: string
  content: string
  tags: string[]
  status: NoteStatus
  createdAt: string
  updatedAt: string
}

type FilterType = 'all' | 'inbox' | 'archived'

/**
 * Scratchpad page - quick note capture for thoughts, ideas, and TODOs
 */
export default function ScratchpadPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [isCreating, setIsCreating] = useState(false)

  // Fetch notes from the server
  const fetchNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = activeFilter === 'all'
        ? '/api/notes'
        : `/api/notes?status=${activeFilter}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }

      const result = await response.json()
      if (result.success && result.data?.notes) {
        setNotes(result.data.notes)
      } else {
        console.error('Unexpected API response format:', result)
        setNotes([])
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeFilter])

  // Fetch notes on mount and when filter changes
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Create a new note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newNoteContent.trim()) {
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newNoteContent }),
      })

      if (!response.ok) {
        throw new Error('Failed to create note')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create note')
      }

      // Clear the input and refetch notes
      setNewNoteContent('')
      await fetchNotes()
    } catch (error) {
      console.error('Error creating note:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Delete a note
  const handleDeleteNote = async (id: string) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete note')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete note')
      }

      await fetchNotes()
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  // Handle voice transcription
  const handleVoiceTranscription = (text: string) => {
    setNewNoteContent(prev => {
      // If there's existing content, add a newline before appending
      if (prev.trim()) {
        return `${prev}\n${text}`
      }
      return text
    })
  }

  // Format date nicely
  const formatDate = (isoDate: string) => {
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

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-rpg-text">Scratchpad</h1>
        <span className="text-sm text-rpg-text-muted">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            activeFilter === 'all'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveFilter('inbox')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            activeFilter === 'inbox'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          Inbox
        </button>
        <button
          onClick={() => setActiveFilter('archived')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            activeFilter === 'archived'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          Archived
        </button>
      </div>

      {/* New note form */}
      <form onSubmit={handleCreateNote} className="space-y-3">
        <textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Quick thought..."
          disabled={isCreating}
          className="w-full px-3 py-2 bg-rpg-card border border-rpg-border rounded-lg text-rpg-text placeholder-rpg-text-dim resize-none focus:outline-none focus:border-rpg-accent transition-colors"
          rows={3}
        />
        <div className="flex items-center gap-3">
          <VoiceButton
            onTranscription={handleVoiceTranscription}
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={!newNoteContent.trim() || isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Creating...' : 'Add Note'}
          </button>
        </div>
      </form>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-rpg-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-lg border border-rpg-border bg-rpg-card hover:border-rpg-accent/50 transition-colors"
            >
              {/* Note header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-xs text-rpg-text-muted">
                  {formatDate(note.createdAt)}
                </span>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="px-2 py-1 text-xs text-rpg-error hover:bg-rpg-error/10 rounded transition-colors"
                >
                  Delete
                </button>
              </div>

              {/* Note content */}
              <p className="text-sm text-rpg-text whitespace-pre-wrap break-words">
                {note.content}
              </p>

              {/* Tags if present */}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-rpg-accent/20 text-rpg-accent rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-rpg-text-dim mb-2">No notes yet</p>
          <p className="text-sm text-rpg-text-muted">
            Capture your thoughts and ideas above
          </p>
        </div>
      )}
    </div>
  )
}
