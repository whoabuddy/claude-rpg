import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Note } from '../../shared/types'

interface CreateIssueModalProps {
  note: Note | null
  onClose: () => void
  onCreated: (noteId: string, issueUrl: string) => void
}

/**
 * Modal for creating a GitHub issue from a note
 */
export function CreateIssueModal({ note, onClose, onCreated }: CreateIssueModalProps) {
  const [repo, setRepo] = useState('')
  const [title, setTitle] = useState('')
  const [labels, setLabels] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successUrl, setSuccessUrl] = useState<string | null>(null)

  // Reset form when note changes
  useEffect(() => {
    if (note) {
      // Default title to first line of note content
      const firstLine = note.content.split('\n')[0].trim()
      setTitle(firstLine)
      setLabels('')
      setError(null)
      setSuccessUrl(null)
    }
  }, [note])

  // Don't render if no note
  if (!note) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!repo.trim()) {
      setError('Repository is required')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/notes/${note.id}/create-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: repo.trim(),
          title: title.trim() || undefined,
          labels: labels.trim() ? labels.split(',').map(l => l.trim()).filter(Boolean) : undefined,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create issue')
      }

      const issueUrl = result.data.issueUrl
      setSuccessUrl(issueUrl)

      // Call the onCreated callback after a brief delay to show success message
      setTimeout(() => {
        onCreated(note.id, issueUrl)
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-rpg-card border border-rpg-border rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-rpg-text">Create GitHub Issue</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-rpg-text-muted hover:text-rpg-text transition-colors disabled:opacity-50"
          >
<X className="w-5 h-5" />
          </button>
        </div>

        {/* Success message */}
        {successUrl && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
            <p className="font-medium mb-1">Issue created successfully!</p>
            <a
              href={successUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-300"
            >
              {successUrl}
            </a>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        {!successUrl && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Repository */}
            <div>
              <label htmlFor="repo" className="block text-sm font-medium text-rpg-text mb-1">
                Repository <span className="text-red-400">*</span>
              </label>
              <input
                id="repo"
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo or full URL"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-rpg-bg border border-rpg-border rounded text-rpg-text placeholder-rpg-text-dim focus:outline-none focus:border-rpg-accent transition-colors disabled:opacity-50"
                required
              />
              <p className="text-xs text-rpg-text-muted mt-1">
                Examples: whoabuddy/claude-rpg or https://github.com/whoabuddy/claude-rpg
              </p>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-rpg-text mb-1">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title (defaults to first line of note)"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-rpg-bg border border-rpg-border rounded text-rpg-text placeholder-rpg-text-dim focus:outline-none focus:border-rpg-accent transition-colors disabled:opacity-50"
              />
            </div>

            {/* Labels */}
            <div>
              <label htmlFor="labels" className="block text-sm font-medium text-rpg-text mb-1">
                Labels
              </label>
              <input
                id="labels"
                type="text"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="bug, enhancement, documentation"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-rpg-bg border border-rpg-border rounded text-rpg-text placeholder-rpg-text-dim focus:outline-none focus:border-rpg-accent transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-rpg-text-muted mt-1">
                Comma-separated list of labels
              </p>
            </div>

            {/* Note preview */}
            <div>
              <label className="block text-sm font-medium text-rpg-text mb-1">
                Note Content (will be issue body)
              </label>
              <div className="px-3 py-2 bg-rpg-bg border border-rpg-border rounded text-rpg-text-muted text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
                {note.content}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-rpg-card border border-rpg-border text-rpg-text rounded hover:bg-rpg-card-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !repo.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Issue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
