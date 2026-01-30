import { useMemo } from 'react'

interface TagSuggestionsProps {
  existingTags: string[]
  onSelect: (tag: string) => void
}

/**
 * Tag suggestions component for quick note tagging
 * Shows common tags and recent tags used in notes
 */
export function TagSuggestions({ existingTags, onSelect }: TagSuggestionsProps) {
  // Combine recent tags with common suggestions
  const suggestions = useMemo(() => {
    const common = ['idea', 'todo', 'bug', 'question', 'followup']
    const recent = existingTags.slice(0, 5)
    return [...new Set([...recent, ...common])].slice(0, 8)
  }, [existingTags])

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map(tag => (
        <button
          key={tag}
          onClick={() => onSelect(tag)}
          className="px-2 py-1 text-xs bg-rpg-border/50 text-rpg-text-muted
                   rounded-full hover:bg-rpg-accent/20 hover:text-rpg-accent
                   transition-colors"
        >
          #{tag}
        </button>
      ))}
    </div>
  )
}
