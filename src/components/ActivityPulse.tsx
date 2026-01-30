import { useState, useEffect } from 'react'

export interface ActivityPulseProps {
  activity?: { timestamp: number; type: 'tool' | 'prompt' | 'stop' | 'error' }
  className?: string
}

/**
 * Visual pulse effect that shows recent activity on a pane.
 * Triggers animation on each new event, with color based on event type.
 */
export function ActivityPulse({ activity, className = '' }: ActivityPulseProps) {
  const [pulseKey, setPulseKey] = useState(0)

  // Trigger new animation on timestamp change
  useEffect(() => {
    if (activity?.timestamp) {
      setPulseKey(prev => prev + 1)
    }
  }, [activity?.timestamp])

  if (!activity) return null

  // Don't show if activity is older than 3 seconds
  const age = Date.now() - activity.timestamp
  if (age > 3000) return null

  const colorClass = {
    tool: 'bg-rpg-working',
    prompt: 'bg-rpg-accent',
    stop: 'bg-rpg-idle',
    error: 'bg-rpg-error',
  }[activity.type]

  return (
    <span
      key={pulseKey}
      className={`absolute inset-0 rounded-full ${colorClass} animate-pulse-ring pointer-events-none ${className}`}
    />
  )
}
