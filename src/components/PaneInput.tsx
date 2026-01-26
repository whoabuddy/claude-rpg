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

  const handleCtrlC = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSendSignal(paneId, 'SIGINT')
  }, [onSendSignal, paneId])

  const handleVoiceTranscription = useCallback((text: string) => {
    send.setInputValue(prev => prev ? `${prev} ${text}` : text)
    ;(send.inputRef.current as HTMLTextAreaElement | null)?.focus()
  }, [send])

  const isFullscreen = variant === 'fullscreen'

  return (
    <div className="space-y-2">
      {/* Input area - always visible */}
      {isPassword ? (
            /* Password input - masked */
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
          ) : isFullscreen ? (
            /* Fullscreen: single-line input with separate buttons */
            <div className="flex gap-2 items-center">
              <input
                ref={send.inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={send.inputValue}
                onChange={(e) => send.setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (send.inputValue.trim()) {
                      send.handleSend()
                    } else {
                      send.handleEnter()
                    }
                  }
                }}
                disabled={send.isSending}
                placeholder={isClaudePane ? "Send prompt..." : "Send input..."}
                className={`flex-1 px-4 py-3 text-base bg-rpg-bg border border-rpg-border rounded-lg focus:border-rpg-accent outline-none ${send.isSending ? 'opacity-50' : ''}`}
              />
              <button
                onClick={send.handleEnter}
                disabled={send.isSending}
                className={`px-4 py-3 bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle rounded-lg transition-colors active:scale-95 ${send.isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Send Enter"
              >
                ⏎
              </button>
              <VoiceButton onTranscription={handleVoiceTranscription} />
              <button
                onClick={(e) => { e.stopPropagation(); send.handleSend() }}
                disabled={!send.inputValue.trim() || send.isSending}
                className="px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors active:scale-95 bg-rpg-accent/30 hover:bg-rpg-accent/50"
              >
                {send.isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          ) : (
            /* Card: textarea with voice button */
            <div className="flex gap-2 items-end">
              <textarea
                ref={send.inputRef as React.RefObject<HTMLTextAreaElement>}
                value={send.inputValue}
                onChange={(e) => {
                  send.setInputValue(e.target.value)
                  // Auto-resize textarea
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    e.stopPropagation()
                    if (send.inputValue.trim()) {
                      send.handleSend()
                    } else {
                      send.handleEnter()
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={send.isSending}
                placeholder={isClaudePane ? "Send prompt... (Shift+Enter for newline)" : "Send input..."}
                className={`flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded focus:border-rpg-accent outline-none min-h-[44px] max-h-[200px] resize-none ${send.isSending ? 'opacity-50' : ''}`}
                rows={1}
              />
              <VoiceButton onTranscription={handleVoiceTranscription} />
            </div>
          )}
          <div className="flex items-center gap-2">
            {!isFullscreen && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (send.inputValue.trim()) {
                    send.handleSend()
                  } else {
                    send.handleEnter()
                  }
                }}
                disabled={send.isSending}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm rounded transition-colors active:scale-95 min-h-[44px] ${
                  send.isSending
                    ? 'bg-rpg-accent/20 text-rpg-text-muted cursor-not-allowed'
                    : send.inputValue.trim()
                      ? isPassword ? 'bg-rpg-waiting/30 hover:bg-rpg-waiting/50' : 'bg-rpg-accent/30 hover:bg-rpg-accent/50'
                      : 'bg-rpg-idle/20 hover:bg-rpg-idle/40 text-rpg-idle'
                }`}
                title={send.inputValue.trim() ? "Send message" : "Send Enter (accept suggestion)"}
              >
                {send.isSending ? 'Sending...' : send.inputValue.trim() ? 'Send' : '⏎ Enter'}
              </button>
            )}
            {!send.isSending && !send.inputValue && send.hasLastPrompt && (
              <button
                onClick={(e) => { e.stopPropagation(); send.handleRestoreLast() }}
                className="px-2 py-1 text-xs text-rpg-text-muted hover:text-rpg-accent transition-colors"
                title="Restore last sent prompt"
              >
                ↩ Restore last
              </button>
            )}
          </div>

      {/* Interrupt button - always visible, dimmed when not applicable */}
      <button
        onClick={handleCtrlC}
        disabled={!canInterrupt}
        className={`${isFullscreen ? 'ml-auto px-6 py-3 rounded-lg' : 'w-full sm:w-auto px-4 py-2 rounded'} text-sm transition-colors active:scale-95 min-h-[44px] ${
          canInterrupt
            ? 'bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error'
            : 'opacity-30 cursor-not-allowed bg-rpg-error/10 text-rpg-error/50'
        }`}
      >
        Interrupt
      </button>

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
