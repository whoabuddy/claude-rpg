import type { PersonaTier } from '../../shared/types'

interface TierBadgeProps {
  tier: PersonaTier
  size?: 'sm' | 'md'
}

// Map tier to display name and color
const TIER_STYLES: Record<PersonaTier, { label: string; className: string }> = {
  novice: { label: 'Novice', className: 'bg-gray-700 text-gray-300' },
  apprentice: { label: 'Apprentice', className: 'bg-green-900 text-green-300' },
  journeyman: { label: 'Journeyman', className: 'bg-blue-900 text-blue-300' },
  expert: { label: 'Expert', className: 'bg-purple-900 text-purple-300' },
  master: { label: 'Master', className: 'bg-amber-900 text-amber-300' },
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const style = TIER_STYLES[tier]
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <span className={`${sizeClass} rounded ${style.className} font-medium`}>
      {style.label}
    </span>
  )
}
