import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { CompanionList } from './components/CompanionList'
import { CompanionDetail } from './components/CompanionDetail'
import { PromptInput } from './components/PromptInput'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useWebSocket } from './hooks/useWebSocket'
import { useCompanions, sendPromptToSession } from './hooks/useCompanions'
import { useNotifications, useSessionNotifications } from './hooks/useNotifications'

type ViewMode = 'dashboard' | 'detail'

export default function App() {
  const { connected, events } = useWebSocket()
  const { companions, selectedId, setSelectedId } = useCompanions(events)
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [notificationsDismissed, setNotificationsDismissed] = useState(false)
  const selectedCompanion = companions.find(c => c.id === selectedId)

  // Notifications
  const { permission, requestPermission, notify } = useNotifications()

  // Track session status changes and send notifications
  useSessionNotifications({
    companions,
    enabled: permission === 'granted',
    notify,
  })

  const handleSendPromptToSession = async (companionId: string, sessionId: string, prompt: string) => {
    await sendPromptToSession(companionId, sessionId, prompt)
  }

  const handleSendPromptFromDetail = async (sessionId: string, prompt: string) => {
    if (!selectedCompanion) return
    await sendPromptToSession(selectedCompanion.id, sessionId, prompt)
  }

  const showNotificationBanner = permission === 'default' && !notificationsDismissed

  return (
    <div className="h-full flex flex-col bg-rpg-bg">
      {/* Notification Permission Banner */}
      {showNotificationBanner && (
        <div className="px-4 py-2 bg-rpg-waiting/20 border-b border-rpg-waiting/50 flex items-center justify-between gap-3">
          <p className="text-sm">
            Enable notifications to be alerted when Claude needs your input
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={requestPermission}
              className="px-3 py-1 text-sm bg-rpg-accent hover:bg-rpg-accent/80 text-rpg-bg rounded transition-colors"
            >
              Enable
            </button>
            <button
              onClick={() => setNotificationsDismissed(true)}
              className="px-3 py-1 text-sm text-rpg-idle hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-rpg-border">
        <h1 className="text-lg font-bold text-rpg-accent">Claude RPG</h1>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-rpg-card rounded border border-rpg-border">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'dashboard'
                  ? 'bg-rpg-accent text-rpg-bg font-medium'
                  : 'text-rpg-idle hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('detail')}
              className={`px-3 py-1 text-xs transition-colors ${
                viewMode === 'detail'
                  ? 'bg-rpg-accent text-rpg-bg font-medium'
                  : 'text-rpg-idle hover:text-white'
              }`}
            >
              Detail
            </button>
          </div>
          <ConnectionStatus connected={connected} />
        </div>
      </header>

      {/* Main content */}
      {viewMode === 'dashboard' ? (
        <main className="flex-1 overflow-y-auto">
          <Dashboard
            companions={companions}
            onSendPrompt={handleSendPromptToSession}
          />
        </main>
      ) : (
        <>
          {/* Companion switcher - only in detail view */}
          <CompanionList
            companions={companions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <main className="flex-1 overflow-y-auto">
            {selectedCompanion ? (
              <CompanionDetail
                companion={selectedCompanion}
                onSendPrompt={handleSendPromptFromDetail}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-rpg-idle">
                <p>No companions yet. Start Claude Code in a project!</p>
              </div>
            )}
          </main>

          {/* Prompt input - only in detail view */}
          {selectedCompanion && (
            <PromptInput
              companion={selectedCompanion}
              disabled={!connected}
            />
          )}
        </>
      )}
    </div>
  )
}
