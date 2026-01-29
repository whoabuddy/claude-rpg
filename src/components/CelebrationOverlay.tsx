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
 * Full-screen celebration overlay for major events.
 *
 * NOTE: This component is prepared for future events (level_up, streak_milestone)
 * that will be dispatched when companion progression is fully implemented.
 * Currently, achievements go through the toast system instead.
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

  // Auto-dismiss after duration
  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(dismiss, CELEBRATION_DURATION)
    return () => clearTimeout(timer)
  }, [celebration, dismiss])

  // Expose trigger for future use (can be called from store subscription)
  useEffect(() => {
    const showCelebration = (e: CustomEvent<Celebration>) => {
      setCelebration(e.detail)
    }
    window.addEventListener('show_celebration', showCelebration as EventListener)
    return () => window.removeEventListener('show_celebration', showCelebration as EventListener)
  }, [])

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
 * Floating XP indicator component - removed as XP notifications now go through toasts.
 * The FloatingXP component was listening for xp_float events that were never dispatched.
 */
