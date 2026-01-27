import { memo } from 'react'

interface ActionButtonProps {
  icon: string
  label: string
  shortLabel?: string
  onClick: (e: React.MouseEvent) => void
  variant?: 'default' | 'danger' | 'accent' | 'ghost'
  disabled?: boolean
  title?: string
  className?: string
  iconOnly?: boolean
}

const VARIANT_CLASSES = {
  default: 'text-rpg-text-dim hover:text-rpg-accent hover:bg-rpg-accent/10',
  danger: 'text-rpg-text-dim hover:text-rpg-error hover:bg-rpg-error/10',
  accent: 'text-rpg-accent hover:bg-rpg-accent/20',
  ghost: 'text-rpg-text-dim hover:text-rpg-text hover:bg-rpg-card-hover',
} as const

export const ActionButton = memo(function ActionButton({
  icon,
  label,
  shortLabel,
  onClick,
  variant = 'default',
  disabled = false,
  title,
  className,
  iconOnly = false,
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
      {!iconOnly && (
        <>
          <span className="hidden sm:inline lg:hidden ml-1 text-xs">{shortLabel || label}</span>
          <span className="hidden lg:inline ml-1 text-xs">{label}</span>
        </>
      )}
    </button>
  )
})
