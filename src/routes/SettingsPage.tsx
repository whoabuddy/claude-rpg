import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useSound } from '../hooks/useSound'
import { useDiscord } from '../hooks/useDiscord'
import { PageHeader } from '../components/PageHeader'

/**
 * Settings page - configure notifications, theme, etc.
 */
export default function SettingsPage() {
  const { permission, requestPermission } = useNotifications()
  const { soundEnabled, toggleSound } = useSound()
  const { webhookUrl, isConfigured, setWebhook, testWebhook } = useDiscord()
  const [webhookInput, setWebhookInput] = useState(webhookUrl)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" backTo="/" />
      <div className="p-4 max-w-xl mx-auto space-y-6 flex-1 overflow-y-auto">

      {/* Notifications */}
      <section className="rounded-lg border border-rpg-border bg-rpg-card p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-4">Notifications</h2>

        <div className="space-y-4">
          {/* Browser notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-rpg-text">Browser Notifications</p>
              <p className="text-xs text-rpg-text-muted">
                Get notified when Claude needs input
              </p>
            </div>
            {permission === 'granted' ? (
              <span className="px-2 py-1 text-xs bg-rpg-working/20 text-rpg-working rounded">
                Enabled
              </span>
            ) : permission === 'denied' ? (
              <span className="px-2 py-1 text-xs bg-rpg-error/20 text-rpg-error rounded">
                Blocked
              </span>
            ) : (
              <button
                onClick={requestPermission}
                className="px-3 py-1 text-sm bg-rpg-accent hover:bg-rpg-accent-dim text-rpg-bg rounded transition-colors"
              >
                Enable
              </button>
            )}
          </div>

          {/* Sound effects */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-rpg-text">Sound Effects</p>
              <p className="text-xs text-rpg-text-muted">
                Play sounds for level-ups and achievements
              </p>
            </div>
            <button
              onClick={toggleSound}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                soundEnabled ? 'bg-rpg-accent' : 'bg-rpg-border'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  soundEnabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Discord Integration */}
      <section className="rounded-lg border border-rpg-border bg-rpg-card p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-4">Discord</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-rpg-text mb-1">Webhook URL</p>
            <p className="text-xs text-rpg-text-muted mb-2">
              Get notifications in Discord when Claude needs input
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookInput}
                onChange={(e) => setWebhookInput(e.target.value)}
                onBlur={() => setWebhook(webhookInput)}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 px-3 py-2 text-sm bg-rpg-bg border border-rpg-border rounded focus:outline-none focus:border-rpg-accent"
              />
              {isConfigured && (
                <button
                  onClick={async () => {
                    setTestStatus('testing')
                    const success = await testWebhook()
                    setTestStatus(success ? 'success' : 'error')
                    setTimeout(() => setTestStatus('idle'), 2000)
                  }}
                  disabled={testStatus === 'testing'}
                  className="px-3 py-2 text-sm bg-rpg-border hover:bg-rpg-border-dim rounded transition-colors disabled:opacity-50"
                >
                  {testStatus === 'testing' ? '...' : testStatus === 'success' ? '✓' : testStatus === 'error' ? '✗' : 'Test'}
                </button>
              )}
            </div>
          </div>
          {isConfigured && (
            <p className="text-xs text-rpg-working">
              ✓ Discord notifications enabled
            </p>
          )}
          <p className="text-xs text-rpg-text-muted">
            <a
              href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rpg-accent hover:underline"
            >
              How to create a webhook
            </a>
          </p>
        </div>
      </section>

      {/* About */}
      <section className="rounded-lg border border-rpg-border bg-rpg-card p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-4">About</h2>
        <div className="space-y-2 text-sm text-rpg-text-muted">
          <p>Claude RPG v2.0.0</p>
          <p>Mobile-first companion for Claude Code with RPG progression.</p>
          <a
            href="https://github.com/whoabuddy/claude-rpg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-rpg-accent hover:underline"
          >
            View on GitHub
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>
      </div>
    </div>
  )
}
