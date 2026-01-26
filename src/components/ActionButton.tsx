import { memo } from 'react'

interface ActionButtonProps {
  icon: string
  label: string
  onClick: (e: React.MouseEvent) => void
  variant?: 'default' | 'danger' | 'accent'
  disabled?: boolean
  title?: string
  className?: string
}

const VARIANT_CLASSES = {
  default: 'text-rpg-text-dim hover:text-rpg-accent hover:bg-rpg-accent/10',
  danger: 'text-rpg-text-dim hover:text-rpg-error hover:bg-rpg-error/10',
  accent: 'text-rpg-accent hover:bg-rpg-accent/20',
} as const

export const ActionButton = memo(function ActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
  title,
  className,
}: ActionButtonProps) {
  const variantClasses = VARIANT_CLASSES[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors ${variantClasses} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className || ''}`}
      title={title || label}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline ml-1 text-xs">{label}</span>
    </button>
  )
})
