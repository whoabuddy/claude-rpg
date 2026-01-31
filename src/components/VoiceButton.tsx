import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { useVoiceInput } from '../hooks/useVoiceInput'

interface VoiceButtonProps {
  onTranscription: (text: string) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

// Auto-dismiss error after this duration
const ERROR_DISMISS_MS = 5000

export const VoiceButton = memo(function VoiceButton({ onTranscription, disabled = false, size = 'md' }: VoiceButtonProps) {
  const { isRecording, isProcessing, error, startRecording, stopRecording, cancelRecording } = useVoiceInput()
  const isActiveRef = useRef(false)
  const [showError, setShowError] = useState(false)

  // Auto-dismiss error after timeout
  useEffect(() => {
    if (error) {
      setShowError(true)
      const timer = setTimeout(() => setShowError(false), ERROR_DISMISS_MS)
      return () => clearTimeout(timer)
    }
    setShowError(false)
  }, [error])

  const handleStart = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || isProcessing) return

    // Start recording immediately for push-to-talk
    try {
      await startRecording()
      isActiveRef.current = true

      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
    } catch {
      // Error handled by hook
    }
  }, [disabled, isProcessing, startRecording])

  const handleEnd = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isActiveRef.current || !isRecording) {
      isActiveRef.current = false
      return
    }

    isActiveRef.current = false

    // Haptic feedback on release
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 50, 30])  // Double pulse for send
    }

    try {
      const text = await stopRecording()
      if (text.trim()) {
        onTranscription(text.trim())
      }
    } catch {
      // Error handled by hook
    }
  }, [isRecording, stopRecording, onTranscription])

  const handleCancel = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isActiveRef.current = false
    cancelRecording()
  }, [cancelRecording])

  // Determine button state
  const isActive = isRecording || isProcessing
  const isDisabled = disabled || isProcessing

  // Size-based classes
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-11 h-11'
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <div className="relative">
      <button
        type="button"
        className={`
          ${sizeClasses} flex items-center justify-center rounded-lg
          transition-all duration-150 select-none touch-none
          ${isRecording
            ? 'bg-rpg-error text-white scale-110 shadow-lg shadow-rpg-error/50 animate-pulse'
            : isProcessing
              ? 'bg-rpg-working text-white cursor-wait'
              : isDisabled
                ? 'bg-rpg-bg-elevated text-rpg-text-dim cursor-not-allowed opacity-50'
                : 'bg-rpg-bg-elevated text-rpg-text-muted hover:bg-rpg-accent/20 hover:text-rpg-accent active:scale-95'
          }
        `}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={isRecording ? handleCancel : undefined}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onTouchCancel={handleCancel}
        onContextMenu={(e) => e.preventDefault()}
        disabled={isDisabled}
        title={isRecording ? 'Release to send' : isProcessing ? 'Processing...' : 'Hold to speak'}
        aria-label={isRecording ? 'Recording - release to send' : isProcessing ? 'Processing audio' : 'Press and hold to record'}
      >
        {isProcessing ? (
          // Spinner
          <svg className={`${iconSize} animate-spin`} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          // Microphone icon
          <svg
            className={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* Recording indicator pulse */}
      {isRecording && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rpg-error opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rpg-error" />
        </span>
      )}

      {/* Error tooltip - auto-dismisses after 5s */}
      {showError && error && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-rpg-error/90 text-white rounded whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
})
