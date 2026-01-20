import { useState, useRef, useEffect } from 'react'
import type { Companion } from '@shared/types'
import { sendPrompt } from '../hooks/useCompanions'

interface PromptInputProps {
  companion: Companion
  disabled?: boolean
}

export function PromptInput({ companion, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [prompt])

  const handleSubmit = async () => {
    if (!prompt.trim() || sending || disabled) return

    setSending(true)
    try {
      const success = await sendPrompt(companion.id, prompt.trim())
      if (success) {
        setPrompt('')
      }
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="p-4 border-t border-rpg-border bg-rpg-card">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${companion.name}...`}
          disabled={disabled || sending}
          rows={1}
          className="
            flex-1 px-4 py-3 rounded-lg
            bg-rpg-bg border border-rpg-border
            text-white placeholder-rpg-idle/50
            resize-none
            focus:outline-none focus:border-rpg-accent
            disabled:opacity-50
          "
        />
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || sending || disabled}
          className="
            px-6 py-3 rounded-lg
            bg-rpg-accent text-white font-medium
            hover:bg-rpg-accent-dim
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
      <p className="text-xs text-rpg-idle/50 mt-2">
        Enter to send, Shift+Enter for newline
      </p>
    </div>
  )
}
