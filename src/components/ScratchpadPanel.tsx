import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { VoiceButton } from './VoiceButton'
import { NoteCard } from './NoteCard'
import { CreateIssueModal } from './CreateIssueModal'
import { TagSuggestions } from './TagSuggestions'
import type { Note, NoteStatus } from '../../shared/types'

type FilterType = 'all' | NoteStatus

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'archived', label: 'Archived' },
  { value: 'converted', label: 'Converted' },
]

interface ScratchpadPanelProps {
  /** Auto-focus the input field */
  autoFocus?: boolean
}

/**
 * Scratchpad panel content - can be used in slide-out panel or standalone page.
 * Quick note capture with filtering and note management.
 */
export function ScratchpadPanel({ autoFocus = false }: ScratchpadPanelProps) {
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

  const handleCreateIssue = useCallback((note: Note) => {
    setSelectedNoteForIssue(note)
  }, [])

  const handleIssueCreated = useCallback(async () => {
    await fetchNotes()
  }, [fetchNotes])

  // Extract unique tags from all notes for suggestions
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach(note => {
      note.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet)
  }, [notes])

  return (
    <div className="p-4 space-y-4">
      {/* Quick capture */}
      <QuickCapture
        onCapture={handleQuickCapture}
        existingTags={uniqueTags}
        autoFocus={autoFocus}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
              activeFilter === value
                ? 'bg-rpg-accent text-rpg-bg font-medium'
                : 'bg-rpg-card text-rpg-text-muted hover:bg-rpg-card-hover'
            }`}
          >
            {label}
            {activeFilter === value && notes.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-rpg-bg text-rpg-accent rounded-full text-xs">
                {notes.length}
              </span>
            )}
          </button>
        ))}
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
  )
}

/**
 * Quick capture component for fast note entry
 */
function QuickCapture({
  onCapture,
  existingTags,
  autoFocus = false,
}: {
  onCapture: (text: string) => void
  existingTags: string[]
  autoFocus?: boolean
}) {
  const [text, setText] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on desktop only (not mobile - keyboard would pop up)
  useEffect(() => {
    if (autoFocus && window.innerWidth >= 640) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

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

  const handleTranscript = (transcript: string) => {
    setText(prev => prev ? `${prev} ${transcript}` : transcript)
  }

  const handleTagSelect = (tag: string) => {
    setText(prev => `${prev} #${tag}`)
    inputRef.current?.focus()
  }

  return (
    <div className="bg-rpg-card border border-rpg-border rounded-lg p-3">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Quick thought... (Cmd+Enter to save)"
        inputMode="text"
        enterKeyHint="send"
        autoComplete="off"
        autoCorrect="on"
        spellCheck={true}
        className="w-full bg-transparent text-rpg-text placeholder-rpg-text-dim
                   resize-none outline-none text-sm"
        rows={2}
        disabled={isCapturing}
      />

      {/* Tag suggestions */}
      {existingTags.length > 0 && (
        <div className="mt-2">
          <TagSuggestions existingTags={existingTags} onSelect={handleTagSelect} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-rpg-text-dim">
          {text.length > 0 && `${text.length} chars`}
        </span>
        <div className="flex gap-2">
          <VoiceButton
            onTranscription={handleTranscript}
            disabled={isCapturing}
            size="sm"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isCapturing}
            className="px-3 py-1.5 text-sm bg-rpg-accent text-rpg-bg rounded-lg
                     disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
          >
            {isCapturing ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact quick capture for inline display on dashboard.
 * Game-UI style: larger tap target, clear action.
 */
export function QuickCaptureCompact({ onOpenPanel }: { onOpenPanel: () => void }) {
  return (
    <button
      onClick={onOpenPanel}
      className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-rpg-card hover:bg-rpg-card-hover border border-rpg-border transition-colors text-left min-h-[56px] active:scale-[0.98]"
    >
      {/* Note icon */}
      <div className="w-8 h-8 rounded-lg bg-rpg-text-dim/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-rpg-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-rpg-text">Quick Note</div>
        <div className="text-sm text-rpg-text-muted">Capture a thought</div>
      </div>

      {/* Arrow */}
      <svg className="w-5 h-5 text-rpg-text-dim flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
