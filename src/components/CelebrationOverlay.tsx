import { useState, useEffect, useCallback, memo } from 'react'

interface Celebration {
  id: string
  type: 'level_up' | 'achievement' | 'streak'
  title: string
  subtitle?: string
  icon?: string
}

const CELEBRATION_DURATION = 3000

/**
 * Full-screen celebration overlay for major events
 */
export const CelebrationOverlay = memo(function CelebrationOverlay() {
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  const dismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      setCelebration(null)
      setIsExiting(false)
    }, 300)
  }, [])

  // Listen for level_up events
  useEffect(() => {
    const handleLevelUp = (e: CustomEvent<{
      companionId: string
      companionName: string
      newLevel: number
      totalXP: number
    }>) => {
      setCelebration({
        id: `levelup-${e.detail.companionId}-${e.detail.newLevel}`,
        type: 'level_up',
        title: `Level ${e.detail.newLevel}!`,
        subtitle: e.detail.companionName,
        icon: '⚔',
      })
    }

    window.addEventListener('level_up', handleLevelUp as EventListener)
    return () => window.removeEventListener('level_up', handleLevelUp as EventListener)
  }, [])

  // Listen for streak milestone events
  useEffect(() => {
    const handleStreak = (e: CustomEvent<{
      companionId: string
      companionName: string
      streakDays: number
    }>) => {
      // Only celebrate milestones: 3, 7, 14, 30, etc
      const days = e.detail.streakDays
      const isMilestone = days === 3 || days === 7 || days === 14 || days === 30 || days % 30 === 0
      if (isMilestone) {
        setCelebration({
          id: `streak-${e.detail.companionId}-${days}`,
          type: 'streak',
          title: `${days} Day Streak!`,
          subtitle: e.detail.companionName,
          icon: '🔥',
        })
      }
    }

    window.addEventListener('streak_milestone', handleStreak as EventListener)
    return () => window.removeEventListener('streak_milestone', handleStreak as EventListener)
  }, [])

  // Auto-dismiss after duration
  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(dismiss, CELEBRATION_DURATION)
    return () => clearTimeout(timer)
  }, [celebration, dismiss])

  if (!celebration) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-auto transition-opacity duration-300 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={dismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-rpg-bg/80 backdrop-blur-sm" />

      {/* Celebration content */}
      <div className={`relative animate-celebration ${isExiting ? 'animate-celebration-exit' : ''}`}>
        {/* Particles/confetti effect */}
        <div className="absolute inset-0 overflow-hidden">
          {celebration.type === 'level_up' && <LevelUpParticles />}
          {celebration.type === 'streak' && <StreakParticles />}
        </div>

        {/* Main content */}
        <div className="text-center relative z-10">
          {/* Icon with glow */}
          <div className="text-6xl mb-4 animate-bounce-once drop-shadow-[0_0_20px_rgba(240,168,72,0.5)]">
            {celebration.icon}
          </div>

          {/* Title */}
          <h1 className={`text-4xl font-bold mb-2 ${
            celebration.type === 'level_up' ? 'text-rpg-accent' :
            celebration.type === 'streak' ? 'text-rpg-streak' :
            'text-rpg-gold'
          }`}>
            {celebration.title}
          </h1>

          {/* Subtitle */}
          {celebration.subtitle && (
            <p className="text-lg text-rpg-text-muted">{celebration.subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
})

/**
 * Simple particle effect for level-up
 */
function LevelUpParticles() {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-rpg-accent animate-particle"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: '50%',
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${1 + Math.random() * 0.5}s`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Fire particles for streak celebration
 */
function StreakParticles() {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-full bg-rpg-streak animate-particle"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: '50%',
            animationDelay: `${i * 0.15}s`,
            animationDuration: `${1.2 + Math.random() * 0.5}s`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Floating XP number that appears when XP is gained
 */
export const FloatingXP = memo(function FloatingXP() {
  const [xpGains, setXpGains] = useState<Array<{ id: number; amount: number; x: number; y: number }>>([])
  const counterRef = { current: 0 }

  useEffect(() => {
    const handleXP = (e: CustomEvent<{ amount: number; x?: number; y?: number }>) => {
      const id = ++counterRef.current
      setXpGains(prev => [
        ...prev.slice(-5), // Keep max 5
        {
          id,
          amount: e.detail.amount,
          x: e.detail.x ?? 50 + Math.random() * 20 - 10,
          y: e.detail.y ?? 50,
        },
      ])

      // Auto-remove after animation
      setTimeout(() => {
        setXpGains(prev => prev.filter(xp => xp.id !== id))
      }, 1000)
    }

    window.addEventListener('xp_float', handleXP as EventListener)
    return () => window.removeEventListener('xp_float', handleXP as EventListener)
  }, [])

  if (xpGains.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {xpGains.map(xp => (
        <div
          key={xp.id}
          className="absolute animate-xp-gain text-rpg-xp font-bold text-xl drop-shadow-lg"
          style={{
            left: `${xp.x}%`,
            top: `${xp.y}%`,
          }}
        >
          +{xp.amount}
        </div>
      ))}
    </div>
  )
})
