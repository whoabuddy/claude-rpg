import { memo } from 'react'

type ViewTab = 'dashboard' | 'quests' | 'workers' | 'competitions'

interface BottomNavProps {
  activeTab: ViewTab
  onTabChange: (tab: ViewTab) => void
  rpgEnabled: boolean
  attentionCount: number
}

const TAB_CONFIG: { id: ViewTab; label: string; icon: string; rpgOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'quests', label: 'Quests', icon: 'Q', rpgOnly: true },
  { id: 'workers', label: 'Workers', icon: '⚙', rpgOnly: true },
  { id: 'competitions', label: 'Leaderboard', icon: '★', rpgOnly: true },
]

export const BottomNav = memo(function BottomNav({ activeTab, onTabChange, rpgEnabled, attentionCount }: BottomNavProps) {
  const tabs = rpgEnabled ? TAB_CONFIG : TAB_CONFIG.filter(t => !t.rpgOnly)

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-rpg-card border-t border-rpg-border safe-area-bottom">
      <div className="flex items-stretch">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-colors min-h-[52px] ${
                isActive
                  ? 'text-rpg-accent bg-rpg-accent/10'
                  : 'text-rpg-text-dim active:bg-rpg-card-hover'
              }`}
            >
              <span className="relative text-base leading-none">
                {tab.icon}
                {tab.id === 'dashboard' && attentionCount > 0 && (
                  <span className="absolute -top-1 -right-2.5 px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-rpg-waiting text-rpg-bg text-[9px] font-bold leading-none">
                    {attentionCount > 9 ? '9+' : attentionCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] leading-none">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
})
