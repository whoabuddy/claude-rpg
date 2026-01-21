import { useState, useEffect, useRef, useCallback, memo } from 'react'
import type { PendingQuestion } from '@shared/types'

// Helper for progress dot styling
function getProgressDotClass(index: number, currentIndex: number): string {
  if (index === currentIndex) return 'bg-rpg-accent'
  if (index < currentIndex) return 'bg-rpg-success'
  return 'bg-rpg-border'
}

interface QuestionInputProps {
  pendingQuestion: PendingQuestion
  onAnswer: (answer: string) => void
  compact?: boolean
}

export const QuestionInput = memo(function QuestionInput({
  pendingQuestion,
  onAnswer,
  compact = false,
}: QuestionInputProps) {
  const { questions, currentIndex, readyToSubmit } = pendingQuestion

  // When all questions answered, show submit confirmation
  if (readyToSubmit) {
    return (
      <div className="space-y-2">
        {/* Progress complete indicator */}
        {questions.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-rpg-text-muted">
            <span>All {questions.length} questions answered</span>
            <div className="flex gap-1">
              {questions.map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-rpg-success" />
              ))}
            </div>
          </div>
        )}

        {/* Confirmation prompt */}
        <div className={`p-3 bg-rpg-success/20 rounded border border-rpg-success/50 ${compact ? 'p-2' : ''}`}>
          <p className={`font-medium ${compact ? 'text-sm' : ''}`}>
            Ready to submit your answers?
          </p>
        </div>

        {/* Submit / Cancel buttons */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAnswer('') // Empty string = Enter key to submit
            }}
            className="flex-1 px-4 py-2 text-sm bg-rpg-success/30 hover:bg-rpg-success/50 text-rpg-success rounded transition-colors active:scale-95 min-h-[44px] font-medium"
          >
            Submit Answers
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAnswer('Escape') // Send Escape to cancel
            }}
            className="px-4 py-2 text-sm bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error rounded transition-colors active:scale-95 min-h-[44px]"
          >
            Cancel
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="text-xs text-rpg-text-dim">
          Press Enter to submit or Escape to cancel
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const options = currentQuestion.options

  // Track focused option index (options.length = custom input)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [customAnswer, setCustomAnswer] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Reset state when question changes
  useEffect(() => {
    setFocusedIndex(0)
    setCustomAnswer('')
    setSelectedOptions(new Set())
    buttonRefs.current = []
  }, [pendingQuestion.toolUseId, currentIndex])

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < options.length) {
      buttonRefs.current[focusedIndex]?.focus()
    } else if (focusedIndex === options.length) {
      customInputRef.current?.focus()
    }
  }, [focusedIndex, options.length])

  // Check if custom input is focused
  const isCustomInputFocused = focusedIndex === options.length

  // Check if there's anything to submit
  const canSubmit = selectedOptions.size > 0 || customAnswer.trim().length > 0

  // Check if focus is on a valid option button
  const isOnOption = focusedIndex >= 0 && focusedIndex < options.length

  const toggleOption = useCallback((index: number) => {
    setSelectedOptions(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Unified submit: combines selected options + custom text
  const handleSubmit = useCallback(() => {
    const parts: string[] = []

    // Add selected options
    if (selectedOptions.size > 0) {
      const selectedLabels = Array.from(selectedOptions)
        .sort()
        .map(i => options[i].label)
      parts.push(...selectedLabels)
    }

    // Add custom text if provided
    if (customAnswer.trim()) {
      parts.push(customAnswer.trim())
    }

    if (parts.length > 0) {
      onAnswer(parts.join(', '))
      setSelectedOptions(new Set())
      setCustomAnswer('')
    }
  }, [selectedOptions, options, customAnswer, onAnswer])

  const handleOptionSelect = useCallback((index: number) => {
    if (currentQuestion.multiSelect) {
      toggleOption(index)
    } else {
      // Single select - immediately answer
      onAnswer(options[index].label)
    }
  }, [currentQuestion.multiSelect, options, onAnswer, toggleOption])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = options.length + 1 // options + custom input

    // When custom input is focused, only handle Tab for navigation
    // Let all other keys work normally for text editing
    if (isCustomInputFocused && e.key !== 'Tab' && e.key !== 'Escape') {
      if (e.key === 'Enter' && canSubmit) {
        e.preventDefault()
        handleSubmit()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        setFocusedIndex(prev => (prev + 1) % totalItems)
        break

      case 'Tab':
        e.preventDefault()
        if (!e.shiftKey) {
          setFocusedIndex(prev => (prev + 1) % totalItems)
        } else {
          setFocusedIndex(prev => (prev - 1 + totalItems) % totalItems)
        }
        break

      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        setFocusedIndex(prev => (prev - 1 + totalItems) % totalItems)
        break

      case 'Enter':
        if (isOnOption) {
          e.preventDefault()
          handleOptionSelect(focusedIndex)
        }
        break

      case ' ':
        // Space for multi-select toggle (only on option buttons)
        if (currentQuestion.multiSelect && isOnOption) {
          e.preventDefault()
          toggleOption(focusedIndex)
        }
        break

      case 'Escape':
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        break
    }
  }, [options.length, focusedIndex, currentQuestion.multiSelect, isCustomInputFocused, isOnOption, canSubmit, handleSubmit, handleOptionSelect, toggleOption])

  // Question progress indicator for multiple questions
  const showProgress = questions.length > 1

  return (
    <div
      ref={containerRef}
      className="space-y-2"
      onKeyDown={handleKeyDown}
    >
      {/* Question progress */}
      {showProgress && (
        <div className="flex items-center gap-2 text-xs text-rpg-text-muted">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${getProgressDotClass(i, currentIndex)}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Question text */}
      <div className={`p-3 bg-rpg-waiting/20 rounded border border-rpg-waiting/50 ${compact ? 'p-2' : ''}`}>
        {currentQuestion.header && (
          <span className="inline-block px-2 py-0.5 text-xs bg-rpg-accent/30 rounded mb-2">
            {currentQuestion.header}
          </span>
        )}
        <p className={`font-medium ${compact ? 'text-sm' : ''}`}>{currentQuestion.question}</p>
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const isSelected = selectedOptions.has(i)
          const isFocused = focusedIndex === i

          return (
            <button
              key={i}
              ref={el => buttonRefs.current[i] = el}
              onClick={(e) => {
                e.stopPropagation()
                handleOptionSelect(i)
              }}
              onFocus={() => setFocusedIndex(i)}
              className={`
                px-3 py-2 text-sm rounded border transition-all active:scale-95 min-h-[40px]
                ${isSelected
                  ? 'bg-rpg-accent/40 border-rpg-accent'
                  : 'bg-rpg-accent/20 border-rpg-accent/50 hover:bg-rpg-accent/30'
                }
                ${isFocused ? 'ring-2 ring-rpg-accent ring-offset-1 ring-offset-rpg-bg' : ''}
              `}
              title={opt.description}
            >
              {currentQuestion.multiSelect && (
                <span className="mr-1.5">
                  {isSelected ? '☑' : '☐'}
                </span>
              )}
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Custom answer input + unified submit */}
      <div className="flex gap-2">
        <input
          ref={customInputRef}
          type="text"
          value={customAnswer}
          onChange={(e) => setCustomAnswer(e.target.value)}
          onFocus={() => setFocusedIndex(options.length)}
          onClick={(e) => e.stopPropagation()}
          placeholder={currentQuestion.multiSelect ? "Add custom text (optional)..." : "Or type custom answer..."}
          className={`
            flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded
            focus:border-rpg-accent outline-none min-h-[40px]
            ${focusedIndex === options.length ? 'ring-2 ring-rpg-accent ring-offset-1 ring-offset-rpg-bg' : ''}
          `}
        />
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleSubmit()
          }}
          disabled={!canSubmit}
          className={`px-4 py-2 text-sm rounded transition-colors active:scale-95 min-h-[40px] ${
            canSubmit
              ? 'bg-rpg-success/30 hover:bg-rpg-success/50 text-rpg-success'
              : 'bg-rpg-accent/30 opacity-50 cursor-not-allowed'
          }`}
        >
          {selectedOptions.size > 0
            ? `Submit${customAnswer.trim() ? ' +' : ` ${selectedOptions.size}`}`
            : 'Send'}
        </button>
      </div>

      {/* Selection summary for multi-select */}
      {currentQuestion.multiSelect && selectedOptions.size > 0 && (
        <div className="text-xs text-rpg-text-muted">
          Selected: {Array.from(selectedOptions).sort().map(i => options[i].label).join(', ')}
          {customAnswer.trim() && ` + "${customAnswer.trim()}"`}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-xs text-rpg-text-dim flex gap-3">
        <span>↑↓ Navigate</span>
        <span>Enter Select</span>
        {currentQuestion.multiSelect && <span>Space Toggle</span>}
      </div>
    </div>
  )
})
