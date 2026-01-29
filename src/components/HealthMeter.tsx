interface HealthMeterProps {
  label: string           // "Energy" or "Morale"
  value: number           // 0-100
  size?: 'sm' | 'md'
}

export function HealthMeter({ label, value, size = 'sm' }: HealthMeterProps) {
  // Clamp value to 0-100
  const percentage = Math.max(0, Math.min(100, value))

  // Determine color based on level
  const getColorClass = () => {
    if (percentage > 70) return 'bg-green-500'
    if (percentage > 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2'
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className={`${textClass} text-rpg-text-muted`}>{label}</span>
        <span className={`${textClass} font-medium text-rpg-text`}>{percentage}%</span>
      </div>
      <div className={`w-full ${heightClass} bg-rpg-border rounded-full overflow-hidden`}>
        <div
          className={`${heightClass} ${getColorClass()} transition-all duration-300 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
