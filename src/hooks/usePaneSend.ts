import { useState, useCallback, useRef } from 'react'
import { lastPromptByPane } from '../utils/prompt-history'

type SendPromptFn = (paneId: string, prompt: string) => Promise<{ ok: boolean; error?: string }>

/**
 * Hook encapsulating prompt input state and resilient send logic.
 * - Only clears input after server confirms delivery
 * - Shows inline error and keeps text on failure
 * - Tracks last successfully sent prompt per pane for recovery
 * - Provides fire-and-forget handleEnter for empty prompt (Enter key)
 */
export function usePaneSend(paneId: string, onSendPrompt: SendPromptFn) {
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  // Track whether this pane has a saved prompt (reactive, unlike the Map itself)
  const [hasLastPrompt, setHasLastPrompt] = useState(() => lastPromptByPane.has(paneId))
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  const clearInlineError = useCallback(() => setInlineError(null), [])

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || isSending) return
    setIsSending(true)
    setInlineError(null)
    const result = await onSendPrompt(paneId, trimmed)
    if (result.ok) {
      lastPromptByPane.set(paneId, trimmed)
      setHasLastPrompt(true)
      setInputValue('')
      // Reset textarea height if applicable
      const el = inputRef.current
      if (el && 'style' in el) {
        (el as HTMLTextAreaElement).style.height = 'auto'
      }
    } else {
      setInlineError(result.error || 'Failed to send')
      setTimeout(() => setInlineError(null), 5000)
    }
    setIsSending(false)
  }, [onSendPrompt, paneId, inputValue, isSending])

  const handleEnter = useCallback(() => {
    onSendPrompt(paneId, '') // Fire-and-forget
  }, [onSendPrompt, paneId])

  const handleRestoreLast = useCallback(() => {
    const last = lastPromptByPane.get(paneId)
    if (last) setInputValue(last)
  }, [paneId])

  return {
    inputValue,
    setInputValue,
    isSending,
    inlineError,
    clearInlineError,
    hasLastPrompt,
    inputRef,
    handleSend,
    handleEnter,
    handleRestoreLast,
  }
}
