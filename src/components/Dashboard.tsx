import type { Companion, Session } from '@shared/types'
import { DashboardSessionCard } from './DashboardSessionCard'

interface DashboardProps {
  companions: Companion[]
  onSendPrompt: (companionId: string, sessionId: string, prompt: string) => void
}

interface SessionWithCompanion extends Session {
  companion: Companion
}

export function Dashboard({ companions, onSendPrompt }: DashboardProps) {
  // Flatten all sessions with companion context
  const allSessions: SessionWithCompanion[] = companions.flatMap(companion =>
    companion.state.sessions.map(session => ({
      ...session,
      companion,
    }))
  )

  // Group by status priority: waiting > error > working > idle
  const waiting = allSessions.filter(s => s.status === 'waiting')
  const error = allSessions.filter(s => s.status === 'error')
  const working = allSessions.filter(s => s.status === 'working')
  const idle = allSessions.filter(s => s.status === 'idle')

  // Sort each group by lastActivity (most recent first)
  const sortByActivity = (a: SessionWithCompanion, b: SessionWithCompanion) =>
    b.lastActivity - a.lastActivity

  waiting.sort(sortByActivity)
  error.sort(sortByActivity)
  working.sort(sortByActivity)
  idle.sort(sortByActivity)

  const hasAnySessions = allSessions.length > 0
  const needsAttention = waiting.length + error.length

  return (
    <div className="p-4 space-y-6">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {hasAnySessions ? (
            <>
              {allSessions.length} Session{allSessions.length !== 1 ? 's' : ''}
              {needsAttention > 0 && (
                <span className="ml-2 text-rpg-waiting">
                  ({needsAttention} need{needsAttention !== 1 ? '' : 's'} attention)
                </span>
              )}
            </>
          ) : (
            'No Active Sessions'
          )}
        </h2>
      </div>

      {!hasAnySessions ? (
        <div className="flex flex-col items-center justify-center py-12 text-rpg-idle">
          <p className="text-lg mb-2">No companions yet</p>
          <p className="text-sm text-rpg-idle/70">Start Claude Code in a project to begin!</p>
        </div>
      ) : (
        <>
          {/* Needs Attention (waiting + error) */}
          {(waiting.length > 0 || error.length > 0) && (
            <SessionGroup
              title="Needs Attention"
              count={needsAttention}
              sessions={[...waiting, ...error]}
              onSendPrompt={onSendPrompt}
              variant="attention"
            />
          )}

          {/* Working */}
          {working.length > 0 && (
            <SessionGroup
              title="Working"
              count={working.length}
              sessions={working}
              onSendPrompt={onSendPrompt}
              variant="working"
            />
          )}

          {/* Idle */}
          {idle.length > 0 && (
            <SessionGroup
              title="Idle"
              count={idle.length}
              sessions={idle}
              onSendPrompt={onSendPrompt}
              variant="idle"
            />
          )}
        </>
      )}
    </div>
  )
}

interface SessionGroupProps {
  title: string
  count: number
  sessions: SessionWithCompanion[]
  onSendPrompt: (companionId: string, sessionId: string, prompt: string) => void
  variant: 'attention' | 'working' | 'idle'
}

function SessionGroup({ title, count, sessions, onSendPrompt, variant }: SessionGroupProps) {
  const variantStyles = {
    attention: 'text-rpg-waiting',
    working: 'text-rpg-working',
    idle: 'text-rpg-idle',
  }

  return (
    <div>
      <h3 className={`text-sm font-medium mb-3 ${variantStyles[variant]}`}>
        {title} ({count})
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map(session => (
          <DashboardSessionCard
            key={`${session.companion.id}:${session.id}`}
            session={session}
            companion={session.companion}
            onSendPrompt={onSendPrompt}
          />
        ))}
      </div>
    </div>
  )
}
