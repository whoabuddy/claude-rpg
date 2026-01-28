import { memo } from 'react'
import type { TerminalPrompt } from '@shared/types'

interface TerminalPromptUIProps {
  prompt: TerminalPrompt
  onAnswer: (answer: string, isPermission?: boolean) => void
  onCancel: () => void
  onNavigate?: (direction: 'up' | 'down') => void
}

export const TerminalPromptUI = memo(function TerminalPromptUI({ prompt, onAnswer, onCancel, onNavigate }: TerminalPromptUIProps) {
  const isPermission = prompt.type === 'permission'
  const isPlan = prompt.type === 'plan'
  const isFeedback = prompt.type === 'feedback'
  const hasSelector = prompt.selectedIndex !== undefined

  // Different styling based on prompt type
  const bgColor = isPermission ? 'bg-rpg-waiting/10' : isPlan ? 'bg-rpg-accent/10' : 'bg-rpg-bg-elevated'
  const borderColor = isPermission ? 'border-rpg-waiting/50' : isPlan ? 'border-rpg-accent/50' : 'border-rpg-border'

  return (
    <div className={`p-3 rounded border ${borderColor} ${bgColor} space-y-3`}>
      {/* Header with tool name for permissions */}
      {isPermission && prompt.tool && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-rpg-waiting/20 text-rpg-waiting rounded">
            {prompt.tool}
          </span>
          {prompt.command && (
            <code className="text-xs text-rpg-text-muted font-mono truncate flex-1">
              {prompt.command.length > 60 ? prompt.command.slice(0, 60) + '...' : prompt.command}
            </code>
          )}
        </div>
      )}

      {/* Plan badge */}
      {isPlan && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-rpg-accent/20 text-rpg-accent rounded">
            Plan Approval
          </span>
        </div>
      )}

      {/* Feedback badge */}
      {isFeedback && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-rpg-bg text-rpg-text-muted rounded border border-rpg-border">
            Feedback (optional)
          </span>
        </div>
      )}

      {/* Question text */}
      <p className="text-sm font-medium">{prompt.question}</p>

      {/* Arrow navigation controls (for selector-style prompts) */}
      {hasSelector && onNavigate && (
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={() => onNavigate('up')}
            className="px-3 py-1.5 text-sm rounded border border-rpg-border bg-rpg-bg hover:bg-rpg-accent/20 transition-colors min-h-[44px]"
            title="Navigate up"
          >
            ▲
          </button>
          <span className="text-xs text-rpg-text-muted">Use arrows to navigate</span>
          <button
            onClick={() => onNavigate('down')}
            className="px-3 py-1.5 text-sm rounded border border-rpg-border bg-rpg-bg hover:bg-rpg-accent/20 transition-colors min-h-[44px]"
            title="Navigate down"
          >
            ▼
          </button>
        </div>
      )}

      {/* Options */}
      <div className={`flex flex-wrap gap-2 ${isPermission || isFeedback ? '' : 'flex-col'}`}>
        {prompt.options.map((option, idx) => {
          // Permission prompts: inline buttons with key hints
          if (isPermission) {
            // Highlight Allow (y) and Deny (n) prominently
            const isAllow = option.key === 'y'
            const isDeny = option.key === 'n'
            const btnClass = isAllow
              ? 'bg-rpg-success/20 hover:bg-rpg-success/40 text-rpg-success border-rpg-success/50'
              : isDeny
              ? 'bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error border-rpg-error/50'
              : 'bg-rpg-bg hover:bg-rpg-border text-rpg-text-muted border-rpg-border'

            return (
              <button
                key={option.key}
                onClick={() => onAnswer(option.key, true)}
                className={`px-3 py-2 text-sm rounded border transition-colors min-h-[44px] ${btnClass}`}
              >
                <span className="font-mono text-xs mr-1.5 opacity-60">[{option.key}]</span>
                {option.label}
              </button>
            )
          }

          // Feedback prompts: horizontal buttons with colored styling
          if (isFeedback) {
            const isBad = option.key === '1'
            const isFine = option.key === '2'
            const isGood = option.key === '3'
            const isDismiss = option.key === '0'

            const btnClass = isBad
              ? 'bg-rpg-error/20 hover:bg-rpg-error/40 text-rpg-error border-rpg-error/50'
              : isGood
              ? 'bg-rpg-success/20 hover:bg-rpg-success/40 text-rpg-success border-rpg-success/50'
              : isFine
              ? 'bg-rpg-bg hover:bg-rpg-border text-rpg-text border-rpg-border'
              : 'bg-rpg-bg hover:bg-rpg-border text-rpg-text-muted border-rpg-border'

            return (
              <button
                key={option.key}
                onClick={() => onAnswer(option.key, true)}
                className={`px-3 py-2 text-sm rounded border transition-colors min-h-[44px] ${btnClass}`}
              >
                <span className="font-mono text-xs mr-1.5 opacity-60">[{option.key}]</span>
                {option.label}
              </button>
            )
          }

          // Question/Plan prompts: vertical list with numbers
          // Highlight the currently selected option (if selector mode)
          const isSelected = hasSelector && idx === prompt.selectedIndex
          const btnClass = isSelected
            ? 'bg-rpg-accent/20 border-rpg-accent/50'
            : 'bg-rpg-bg hover:bg-rpg-border border-rpg-border'

          return (
            <button
              key={option.key}
              onClick={() => onAnswer(option.key)}
              className={`flex items-start gap-2 px-3 py-2 text-sm text-left rounded border transition-colors min-h-[44px] ${btnClass}`}
            >
              <span className="font-mono text-rpg-accent shrink-0">({option.key})</span>
              <span className="text-rpg-text">{option.label}</span>
              {isSelected && <span className="ml-auto text-rpg-accent">←</span>}
            </button>
          )
        })}
      </div>

      {/* Footer with cancel hint (skip for feedback - 0 is Dismiss) */}
      {prompt.footer && !isFeedback && (
        <div className="flex items-center justify-between text-xs text-rpg-text-dim">
          <span>{prompt.footer}</span>
          <button
            onClick={onCancel}
            className="px-2 py-1 hover:bg-rpg-error/20 hover:text-rpg-error rounded transition-colors"
          >
            Cancel (Esc)
          </button>
        </div>
      )}
    </div>
  )
})
