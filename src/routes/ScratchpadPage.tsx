import { useState, useEffect, useCallback } from 'react'
import { VoiceButton } from '../components/VoiceButton'
import { NoteCard } from '../components/NoteCard'
import { CreateIssueModal } from '../components/CreateIssueModal'

type NoteStatus = 'inbox' | 'triaged' | 'archived' | 'converted'

interface Note {
  id: string
  content: string
  tags: string[]
  status: NoteStatus
  createdAt: string
  updatedAt: string
}

type FilterType = 'all' | 'inbox' | 'triaged' | 'archived' | 'converted'

/**
 * Scratchpad page - quick note capture for thoughts, ideas, and TODOs
 */
export default function ScratchpadPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [selectedNoteForIssue, setSelectedNoteForIssue] = useState<Note | null>(null)

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

  // Update note status
  const handleStatusChange = async (id: string, status: NoteStatus) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Failed to update note')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update note')
      }

      await fetchNotes()
    } catch (error) {
      console.error('Error updating note:', error)
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

  // Count notes by status for badges
  const getStatusCount = (status: FilterType): number => {
    if (status === 'all') return notes.length
    return notes.filter(n => n.status === status).length
  }

  // Handle creating a GitHub issue from a note
  const handleCreateIssue = (note: Note) => {
    setSelectedNoteForIssue(note)
  }

  // Handle issue creation success
  const handleIssueCreated = async (noteId: string, issueUrl: string) => {
    // Refetch notes to show updated status
    await fetchNotes()
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
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          All
          {activeFilter === 'all' && notes.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rpg-bg text-rpg-accent rounded-full text-xs">
              {notes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('inbox')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
            activeFilter === 'inbox'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          Inbox
          {activeFilter === 'inbox' && notes.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rpg-bg text-rpg-accent rounded-full text-xs">
              {notes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('triaged')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
            activeFilter === 'triaged'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          Triaged
          {activeFilter === 'triaged' && notes.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rpg-bg text-rpg-accent rounded-full text-xs">
              {notes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('archived')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
            activeFilter === 'archived'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          Archived
          {activeFilter === 'archived' && notes.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rpg-bg text-rpg-accent rounded-full text-xs">
              {notes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('converted')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
            activeFilter === 'converted'
              ? 'bg-rpg-accent text-rpg-bg font-medium'
              : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
          }`}
        >
          Converted
          {activeFilter === 'converted' && notes.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rpg-bg text-rpg-accent rounded-full text-xs">
              {notes.length}
            </span>
          )}
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
            <NoteCard
              key={note.id}
              note={note}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteNote}
              onCreateIssue={handleCreateIssue}
            />
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

      {/* Create Issue Modal */}
      <CreateIssueModal
        note={selectedNoteForIssue}
        onClose={() => setSelectedNoteForIssue(null)}
        onCreated={handleIssueCreated}
      />
    </div>
  )
}
