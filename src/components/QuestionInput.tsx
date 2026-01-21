import { useState, useEffect, useRef, useCallback, memo } from 'react'
import type { PendingQuestion, Question } from '@shared/types'

interface QuestionInputProps {
  pendingQuestion: PendingQuestion
  onAnswer: (answer: string) => void
  onCustomInput?: (input: string) => void
  compact?: boolean
}

export const QuestionInput = memo(function QuestionInput({
  pendingQuestion,
  onAnswer,
  compact = false,
}: QuestionInputProps) {
  const { questions, currentIndex } = pendingQuestion
  const currentQuestion = questions[currentIndex]
  const options = currentQuestion.options

  // Track focused option index (-1 means custom input is focused)
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
  }, [pendingQuestion.toolUseId, currentIndex])

  // Focus management
  useEffect(() => {
    if (focusedIndex === -1) {
      customInputRef.current?.focus()
    } else if (focusedIndex >= 0 && focusedIndex < options.length) {
      buttonRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex, options.length])

  // Check if custom input is focused
  const isCustomInputFocused = focusedIndex === options.length

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = options.length + 1 // options + custom input

    // When custom input is focused, only handle Tab for navigation
    // Let all other keys work normally for text editing
    if (isCustomInputFocused && e.key !== 'Tab' && e.key !== 'Escape') {
      // Don't prevent default - let the input handle the key
      if (e.key === 'Enter' && customAnswer.trim()) {
        e.preventDefault()
        onAnswer(customAnswer.trim())
        setCustomAnswer('')
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        setFocusedIndex(prev => {
          const next = prev + 1
          return next >= totalItems ? 0 : next
        })
        break

      case 'Tab':
        e.preventDefault()
        if (!e.shiftKey) {
          setFocusedIndex(prev => {
            const next = prev + 1
            return next >= totalItems ? 0 : next
          })
        } else {
          setFocusedIndex(prev => {
            const next = prev - 1
            return next < 0 ? totalItems - 1 : next
          })
        }
        break

      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        setFocusedIndex(prev => {
          const next = prev - 1
          return next < 0 ? totalItems - 1 : next
        })
        break

      case 'Enter':
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          e.preventDefault()
          handleOptionSelect(focusedIndex)
        }
        break

      case ' ':
        // Space for multi-select toggle (only on option buttons)
        if (currentQuestion.multiSelect && focusedIndex >= 0 && focusedIndex < options.length) {
          e.preventDefault()
          toggleOption(focusedIndex)
        }
        break

      case 'Escape':
        // Blur current focus
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        break
    }
  }, [options.length, focusedIndex, customAnswer, currentQuestion.multiSelect, onAnswer, isCustomInputFocused])

  const handleOptionSelect = useCallback((index: number) => {
    if (currentQuestion.multiSelect) {
      toggleOption(index)
    } else {
      // Single select - immediately answer
      onAnswer(options[index].label)
    }
  }, [currentQuestion.multiSelect, options, onAnswer])

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

  const submitMultiSelect = useCallback(() => {
    if (selectedOptions.size > 0) {
      const selectedLabels = Array.from(selectedOptions)
        .sort()
        .map(i => options[i].label)
        .join(', ')
      onAnswer(selectedLabels)
      setSelectedOptions(new Set())
    }
  }, [selectedOptions, options, onAnswer])

  const handleCustomSubmit = useCallback(() => {
    if (customAnswer.trim()) {
      onAnswer(customAnswer.trim())
      setCustomAnswer('')
    }
  }, [customAnswer, onAnswer])

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
                className={`w-2 h-2 rounded-full ${
                  i === currentIndex
                    ? 'bg-rpg-accent'
                    : i < currentIndex
                    ? 'bg-rpg-success'
                    : 'bg-rpg-border'
                }`}
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

      {/* Multi-select submit */}
      {currentQuestion.multiSelect && selectedOptions.size > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            submitMultiSelect()
          }}
          className="w-full px-4 py-2 text-sm bg-rpg-success/30 hover:bg-rpg-success/50 text-rpg-success rounded transition-colors active:scale-95 min-h-[40px]"
        >
          Submit {selectedOptions.size} selected
        </button>
      )}

      {/* Custom answer input */}
      <div className="flex gap-2">
        <input
          ref={customInputRef}
          type="text"
          value={customAnswer}
          onChange={(e) => setCustomAnswer(e.target.value)}
          onFocus={() => setFocusedIndex(options.length)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Or type custom answer..."
          className={`
            flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded
            focus:border-rpg-accent outline-none min-h-[40px]
            ${focusedIndex === options.length ? 'ring-2 ring-rpg-accent ring-offset-1 ring-offset-rpg-bg' : ''}
          `}
        />
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCustomSubmit()
          }}
          disabled={!customAnswer.trim()}
          className="px-4 py-2 text-sm bg-rpg-accent/30 hover:bg-rpg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors active:scale-95 min-h-[40px]"
        >
          Send
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-rpg-text-dim flex gap-3">
        <span>↑↓ Navigate</span>
        <span>Enter Select</span>
        {currentQuestion.multiSelect && <span>Space Toggle</span>}
      </div>
    </div>
  )
})
