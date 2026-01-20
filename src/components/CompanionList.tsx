import type { Companion } from '@shared/types'
import { xpForLevel } from '@shared/types'

interface CompanionListProps {
  companions: Companion[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CompanionList({ companions, selectedId, onSelect }: CompanionListProps) {
  if (companions.length === 0) {
    return null
  }

  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-rpg-border">
      {companions.map((companion) => (
        <CompanionChip
          key={companion.id}
          companion={companion}
          selected={companion.id === selectedId}
          onSelect={() => onSelect(companion.id)}
        />
      ))}
    </div>
  )
}

interface CompanionChipProps {
  companion: Companion
  selected: boolean
  onSelect: () => void
}

function CompanionChip({ companion, selected, onSelect }: CompanionChipProps) {
  const statusColors = {
    idle: 'bg-rpg-idle',
    working: 'bg-rpg-working',
    waiting: 'bg-rpg-waiting',
    attention: 'bg-rpg-error',
    offline: 'bg-rpg-idle/50',
  }

  return (
    <button
      onClick={onSelect}
      className={`
        flex flex-col items-center gap-1 p-2 rounded-lg min-w-[70px]
        transition-all touch-feedback
        ${selected
          ? 'bg-rpg-accent/20 border border-rpg-accent'
          : 'bg-rpg-card border border-rpg-border hover:border-rpg-accent/50'
        }
      `}
    >
      {/* Avatar with status indicator */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-rpg-accent/30 flex items-center justify-center text-lg">
          {companion.name[0]}
        </div>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-rpg-card ${
            statusColors[companion.state.status]
          } ${companion.state.status === 'working' ? 'animate-pulse' : ''}`}
        />
      </div>

      {/* Name and level */}
      <div className="text-center">
        <div className="text-xs font-medium truncate max-w-[60px]">
          {companion.name}
        </div>
        <div className="text-[10px] text-rpg-xp">
          Lv.{companion.level}
        </div>
      </div>
    </button>
  )
}
