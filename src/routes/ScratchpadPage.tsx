import { useState, useEffect, useCallback, useRef } from 'react'
import { VoiceButton } from '../components/VoiceButton'
import { NoteCard } from '../components/NoteCard'
import { CreateIssueModal } from '../components/CreateIssueModal'
import { PageHeader } from '../components/PageHeader'
import type { Note, NoteStatus } from '../../shared/types'

type FilterType = 'all' | NoteStatus

/**
 * Quick capture component for fast note entry
 */
function QuickCapture({ onCapture }: { onCapture: (text: string) => void }) {
  const [text, setText] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (text.trim() && !isCapturing) {
      setIsCapturing(true)
      await onCapture(text.trim())
      setText('')
      setIsCapturing(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="bg-rpg-card border border-rpg-border rounded-lg p-3">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Quick thought... (Cmd+Enter to save)"
        className="w-full bg-transparent text-rpg-text placeholder-rpg-text-dim
                   resize-none outline-none text-sm"
        rows={2}
        disabled={isCapturing}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-rpg-text-dim">
          {text.length > 0 && `${text.length} chars`}
        </span>
        <div className="flex gap-2">
          <VoiceButton onTranscription={t => setText(prev => prev + t)} disabled={isCapturing} />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isCapturing}
            className="px-3 py-1.5 text-sm bg-rpg-accent text-rpg-bg rounded-lg
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCapturing ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Scratchpad page - quick note capture for thoughts, ideas, and TODOs
 */
export default function ScratchpadPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
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

  // Handle quick capture
  const handleQuickCapture = useCallback(async (text: string) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: text, status: 'inbox' }),
      })

      if (!response.ok) {
        throw new Error('Failed to create note')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create note')
      }

      // Refetch notes to show the new one
      await fetchNotes()
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }, [fetchNotes])

  // Update note status
  const handleStatusChange = useCallback(async (id: string, status: NoteStatus) => {
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
  }, [fetchNotes])

  // Delete a note
  const handleDeleteNote = useCallback(async (id: string) => {
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
  }, [fetchNotes])


  // Handle creating a GitHub issue from a note
  const handleCreateIssue = useCallback((note: Note) => {
    setSelectedNoteForIssue(note)
  }, [])

  // Handle issue creation success
  const handleIssueCreated = useCallback(async () => {
    // Refetch notes to show updated status
    await fetchNotes()
  }, [fetchNotes])

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Scratchpad">
        <span className="text-sm text-rpg-text-muted">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </PageHeader>
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
      {/* Quick capture */}
      <QuickCapture onCapture={handleQuickCapture} />

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
    </div>
  )
}
