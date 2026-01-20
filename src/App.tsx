import { CompanionList } from './components/CompanionList'
import { CompanionDetail } from './components/CompanionDetail'
import { PromptInput } from './components/PromptInput'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useWebSocket } from './hooks/useWebSocket'
import { useCompanions, sendPromptToSession } from './hooks/useCompanions'

export default function App() {
  const { connected, events } = useWebSocket()
  const { companions, selectedId, setSelectedId } = useCompanions(events)
  const selectedCompanion = companions.find(c => c.id === selectedId)

  const handleSendPromptToSession = async (sessionId: string, prompt: string) => {
    if (!selectedCompanion) return
    await sendPromptToSession(selectedCompanion.id, sessionId, prompt)
  }

  return (
    <div className="h-full flex flex-col bg-rpg-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-rpg-border">
        <h1 className="text-lg font-bold text-rpg-accent">Claude RPG</h1>
        <ConnectionStatus connected={connected} />
      </header>

      {/* Companion switcher */}
      <CompanionList
        companions={companions}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {selectedCompanion ? (
          <CompanionDetail
            companion={selectedCompanion}
            onSendPrompt={handleSendPromptToSession}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-rpg-idle">
            <p>No companions yet. Start Claude Code in a project!</p>
          </div>
        )}
      </main>

      {/* Prompt input */}
      {selectedCompanion && (
        <PromptInput
          companion={selectedCompanion}
          disabled={!connected}
        />
      )}
    </div>
  )
}
