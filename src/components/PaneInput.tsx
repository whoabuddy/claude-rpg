import { useRef, useMemo, useCallback, memo } from 'react'
import type { TmuxPane } from '@shared/types'
import { usePaneSend } from '../hooks/usePaneSend'
import { isPasswordPrompt } from '../utils/password-detection'
import { usePaneTerminal } from '../hooks/usePaneTerminal'
import { VoiceButton } from './VoiceButton'

interface PaneInputProps {
  paneId: string
  pane: TmuxPane
  onSendPrompt: (paneId: string, prompt: string) => Promise<{ ok: boolean; error?: string }>
  onSendSignal: (paneId: string, signal: string) => void
  variant: 'card' | 'fullscreen'
}

export const PaneInput = memo(function PaneInput({ paneId, pane, onSendPrompt, onSendSignal, variant }: PaneInputProps) {
  const terminalContent = usePaneTerminal(paneId)
  const send = usePaneSend(paneId, onSendPrompt)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession
  const isPassword = useMemo(() => isPasswordPrompt(terminalContent), [terminalContent])

  const canInterrupt = (isClaudePane && session?.status === 'working') || pane.process.type === 'process'
  const hasText = send.inputValue.trim().length > 0

  const handleCtrlC = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSendSignal(paneId, 'SIGINT')
  }, [onSendSignal, paneId])

  const handleVoiceTranscription = useCallback((text: string) => {
    send.setInputValue(prev => prev ? `${prev} ${text}` : text)
    ;(send.inputRef.current as HTMLTextAreaElement | null)?.focus()
  }, [send])

  const handleSendOrEnter = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (send.inputValue.trim()) {
      send.handleSend()
    } else {
      send.handleEnter()
    }
  }, [send])

  const isFullscreen = variant === 'fullscreen'

  // Password input — same in both modes
  if (isPassword) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <span className="text-rpg-waiting text-sm">🔒</span>
          <input
            ref={passwordInputRef}
            type="password"
            value={send.inputValue}
            onChange={(e) => send.setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                send.handleSend()
              }
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={send.isSending}
            placeholder="Enter password..."
            className={`flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-waiting/50 rounded focus:border-rpg-waiting outline-none min-h-[44px] ${send.isSending ? 'opacity-50' : ''}`}
            autoComplete="off"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Row 1: Input + Voice */}
      <div className={`flex gap-2 ${isFullscreen ? 'items-center' : 'items-end'}`}>
        {isFullscreen ? (
          <input
            ref={send.inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={send.inputValue}
            onChange={(e) => send.setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (hasText) send.handleSend()
                else send.handleEnter()
              }
            }}
            disabled={send.isSending}
            placeholder={isClaudePane ? "Send prompt..." : "Send input..."}
            className={`flex-1 px-4 py-3 text-base bg-rpg-bg border border-rpg-border rounded-lg focus:border-rpg-accent outline-none ${send.isSending ? 'opacity-50' : ''}`}
          />
        ) : (
          <textarea
            ref={send.inputRef as React.RefObject<HTMLTextAreaElement>}
            value={send.inputValue}
            onChange={(e) => {
              send.setInputValue(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.stopPropagation()
                if (hasText) send.handleSend()
                else send.handleEnter()
              }
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={send.isSending}
            placeholder={isClaudePane ? "Send prompt... (Shift+Enter for newline)" : "Send input..."}
            className={`flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none min-h-[44px] max-h-[200px] resize-none ${send.isSending ? 'opacity-50' : ''}`}
            rows={1}
          />
        )}
        <VoiceButton onTranscription={handleVoiceTranscription} />
      </div>

      {/* Row 2: Actions — Send/Enter + Restore + Interrupt */}
      <div className="flex items-center gap-2">
        {/* Primary: Send or Enter */}
        <button
          onClick={handleSendOrEnter}
          disabled={send.isSending}
          className={`px-4 ${isFullscreen ? 'py-3 rounded-lg' : 'py-2 rounded'} text-sm transition-colors active:scale-95 min-h-[44px] ${
            send.isSending
              ? 'bg-rpg-accent/20 text-rpg-text-muted cursor-not-allowed'
              : hasText
                ? 'bg-rpg-accent/30 hover:bg-rpg-accent/50'
                : 'bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle'
          }`}
          title={hasText ? "Send message" : "Send Enter (accept suggestion)"}
        >
          {send.isSending ? '...' : hasText ? 'Send' : '⏎ Enter'}
        </button>

        {/* Restore last prompt */}
        {!send.isSending && !send.inputValue && send.hasLastPrompt && (
          <button
            onClick={(e) => { e.stopPropagation(); send.handleRestoreLast() }}
            className="px-2 py-1 text-xs text-rpg-text-muted hover:text-rpg-accent transition-colors"
            title="Restore last sent prompt"
          >
            ↩ Last
          </button>
        )}

        {/* Spacer pushes interrupt to the right */}
        <div className="flex-1" />

        {/* Interrupt — secondary, right-aligned */}
        <button
          onClick={handleCtrlC}
          disabled={!canInterrupt}
          className={`px-3 ${isFullscreen ? 'py-3 rounded-lg' : 'py-2 rounded'} text-sm transition-colors active:scale-95 min-h-[44px] border ${
            canInterrupt
              ? 'border-rpg-error/40 text-rpg-error hover:bg-rpg-error/20'
              : 'border-transparent opacity-20 cursor-not-allowed text-rpg-error/50'
          }`}
        >
          Interrupt
        </button>
      </div>

      {/* Inline error banner */}
      {send.inlineError && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-rpg-error/20 border border-rpg-error/50 rounded text-sm text-rpg-error">
          <span>{send.inlineError}</span>
          <button
            onClick={(e) => { e.stopPropagation(); send.clearInlineError() }}
            className="text-rpg-error/60 hover:text-rpg-error text-xs px-1"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
})
