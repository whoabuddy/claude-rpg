import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  backTo?: string  // Route to go back to, undefined = no back button
  backLabel?: string  // Accessible label for back button
  children?: React.ReactNode  // Actions slot (right side)
}

export function PageHeader({ title, backTo, backLabel, children }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-rpg-border bg-rpg-bg-elevated">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="p-1.5 -ml-1.5 text-rpg-text-muted hover:text-rpg-text rounded-lg hover:bg-rpg-card transition-colors"
          aria-label={backLabel || 'Go back'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <h1 className="text-lg font-bold text-rpg-text flex-1">{title}</h1>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </header>
  )
}
