import { useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Optional action button in header */
  headerAction?: ReactNode
}

/**
 * Slide-out panel that overlays from the right side.
 * Used for Quests and Scratchpad on mobile single-screen dashboard.
 */
export function SlidePanel({ open, onClose, title, children, headerAction }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Focus trap - focus panel when opened
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus()
    }
  }, [open])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="slide-panel-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 transition-opacity" />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative ml-auto h-full w-full max-w-md bg-rpg-bg border-l border-rpg-border shadow-xl flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rpg-border bg-rpg-bg-elevated">
          <h2 id="slide-panel-title" className="text-lg font-semibold text-rpg-text">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              onClick={onClose}
              className="p-2 text-rpg-text-muted hover:text-rpg-text hover:bg-rpg-card rounded-lg transition-colors"
              aria-label="Close panel"
            >
<X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
