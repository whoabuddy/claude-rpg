import type { PersonaChallenge } from '../../shared/types'

interface ChallengeCardProps {
  challenge: PersonaChallenge
  compact?: boolean
}

export function ChallengeCard({ challenge, compact = false }: ChallengeCardProps) {
  const progress = Math.max(0, Math.min(100, (challenge.progress / challenge.target) * 100))
  const isCompleted = challenge.status === 'completed'

  // Calculate time remaining
  const timeRemaining = () => {
    const now = new Date()
    const expires = new Date(challenge.expiresAt)
    const diff = expires.getTime() - now.getTime()

    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 24) return `${hours}h remaining`

    const days = Math.floor(hours / 24)
    return `${days}d remaining`
  }

  return (
    <div className={`rounded-lg border border-rpg-border bg-rpg-card ${compact ? 'p-3' : 'p-4'} ${
      isCompleted ? 'opacity-75' : ''
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-medium text-rpg-text ${compact ? 'text-sm' : 'text-base'}`}>
              {challenge.name}
            </h3>
            {isCompleted && (
              <span className="text-green-500" title="Completed">✓</span>
            )}
          </div>
          {!compact && (
            <p className="text-xs text-rpg-text-muted mt-1">{challenge.description}</p>
          )}
        </div>

        {/* Period pill */}
        <span className={`${compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'} rounded bg-rpg-border text-rpg-text-muted uppercase font-medium flex-shrink-0`}>
          {challenge.period}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-rpg-text-muted">
            {challenge.progress} / {challenge.target}
          </span>
          <span className="text-xs text-rpg-text-muted">{Math.floor(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-rpg-border rounded-full overflow-hidden">
          <div
            className={`h-2 transition-all duration-300 rounded-full ${
              isCompleted ? 'bg-green-500' : 'bg-rpg-accent'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer: XP reward and time remaining */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-rpg-accent font-medium">+{challenge.xpReward} XP</span>
        {!isCompleted && challenge.status !== 'expired' && (
          <span className="text-rpg-text-dim">{timeRemaining()}</span>
        )}
        {challenge.status === 'expired' && (
          <span className="text-rpg-error">Expired</span>
        )}
      </div>
    </div>
  )
}
