import { useRef, useEffect, useMemo, memo } from 'react'
import { ansiToHtml } from '../utils/ansi'

interface TerminalDisplayProps {
  content: string | undefined
  onTerminalClick?: () => void
  className?: string
}

export const TerminalDisplay = memo(function TerminalDisplay({ content, onTerminalClick, className }: TerminalDisplayProps) {
  const terminalRef = useRef<HTMLDivElement>(null)

  const htmlContent = useMemo(() => content ? ansiToHtml(content) : null, [content])

  useEffect(() => {
    if (!terminalRef.current) return
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    })
  }, [content])

  return (
    <div
      ref={terminalRef}
      onClick={onTerminalClick}
      className={className || "bg-rpg-bg rounded p-3 text-xs font-mono text-rpg-working overflow-auto max-h-64 whitespace-pre-wrap border border-rpg-border-dim cursor-text"}
    >
      {htmlContent ? (
        <pre className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      ) : (
        <pre className="whitespace-pre-wrap"><span className="text-rpg-text-dim">Waiting for activity...</span></pre>
      )}
    </div>
  )
})
