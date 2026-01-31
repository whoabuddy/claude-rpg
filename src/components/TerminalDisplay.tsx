import { useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { ansiToHtml } from '../utils/ansi'
import { linkifyTerminalHtml } from '../utils/linkify'

interface TerminalDisplayProps {
  content: string | undefined
  onTerminalClick?: () => void
  onCopy?: () => void
  className?: string
}

export const TerminalDisplay = memo(function TerminalDisplay({ content, onTerminalClick, onCopy, className }: TerminalDisplayProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true) // Track if user is scrolled to bottom

  const htmlContent = useMemo(() => {
    if (!content) return null
    return linkifyTerminalHtml(ansiToHtml(content))
  }, [content])

  // Update isAtBottom on scroll
  useEffect(() => {
    const el = terminalRef.current
    if (!el) return

    const handleScroll = () => {
      // Consider "at bottom" if within 50px of the end
      const threshold = 50
      const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      isAtBottomRef.current = scrollBottom < threshold
    }

    el.addEventListener('scroll', handleScroll)
    // Initialize scroll position check immediately
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // Only auto-scroll if user was already at bottom
  useEffect(() => {
    if (!terminalRef.current || !isAtBottomRef.current) return
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    })
  }, [content])

  // After copying text from terminal, notify parent to refocus input (#62)
  useEffect(() => {
    const el = terminalRef.current
    if (!el || !onCopy) return
    const handleCopy = () => {
      // Small delay to let the copy complete before refocusing
      setTimeout(() => onCopy(), 50)
    }
    el.addEventListener('copy', handleCopy)
    return () => el.removeEventListener('copy', handleCopy)
  }, [onCopy])

  // Handle Ctrl+Click on terminal links
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('terminal-link') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      const href = target.getAttribute('data-href')
      const type = target.getAttribute('data-type')
      if (href) {
        if (type === 'url') {
          window.open(href, '_blank', 'noopener,noreferrer')
        }
        // File paths: could integrate with editor opening in the future
        // For now, just copy to clipboard
        if (type === 'file') {
          navigator.clipboard.writeText(href).catch(() => {})
        }
      }
      return
    }
    onTerminalClick?.()
  }, [onTerminalClick])

  return (
    <div
      ref={terminalRef}
      onClick={handleClick}
      className={className || "bg-rpg-bg rounded p-2 text-xs font-mono text-rpg-working overflow-auto max-h-48 whitespace-pre-wrap cursor-text"}
    >
      {htmlContent ? (
        <pre className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      ) : (
        <pre className="whitespace-pre-wrap"><span className="text-rpg-text-dim">Waiting for activity...</span></pre>
      )}
    </div>
  )
})
