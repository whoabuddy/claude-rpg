interface ConnectionStatusProps {
  connected: boolean
}

export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          connected ? 'bg-rpg-success' : 'bg-rpg-error animate-pulse'
        }`}
      />
      <span className="text-xs text-rpg-idle">
        {connected ? 'Connected' : 'Reconnecting...'}
      </span>
    </div>
  )
}
