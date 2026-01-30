import { memo, useState, useEffect } from 'react'
import type { TmuxPane } from '@shared/types'
import { ActivityPulse } from './ActivityPulse'
import type { PaneActivity } from '../store'

interface PaneAvatarProps {
  pane: TmuxPane
  size?: 'sm' | 'md' | 'lg'
  activity?: PaneActivity
}

export const PaneAvatar = memo(function PaneAvatar({ pane, size = 'md', activity }: PaneAvatarProps) {
  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession
  const [loadError, setLoadError] = useState(false)

  const dimensions = {
    sm: { avatar: 'w-6 h-6', font: 'text-xs', shell: 'w-6 h-6 text-xs', wrapper: 'w-6 h-6' },
    md: { avatar: 'w-10 h-10', font: 'text-base', shell: 'w-8 h-8 text-sm', wrapper: 'w-10 h-10' },
    lg: { avatar: 'w-12 h-12', font: 'text-lg', shell: 'w-10 h-10 text-base', wrapper: 'w-12 h-12' },
  }
  const { avatar: dimension, font: fontSize, shell: shellSize, wrapper: wrapperSize } = dimensions[size]

  // Reset error state when avatar changes
  useEffect(() => {
    setLoadError(false)
  }, [session?.avatarSvg])

  if (isClaudePane && session) {
    // Show initials fallback if no avatar or load error
    if (!session.avatarSvg || loadError) {
      return (
        <div className={`${dimension} rounded-full bg-rpg-accent/30 flex items-center justify-center ${fontSize} font-bold flex-shrink-0`}>
          {session.name[0]}
        </div>
      )
    }

    // Check if it's a URL or inline SVG
    const isUrl = session.avatarSvg.startsWith('http') || session.avatarSvg.startsWith('/api')
    if (isUrl) {
      return (
        <img
          src={session.avatarSvg}
          alt={session.name}
          className={`${dimension} rounded-full bg-rpg-bg flex-shrink-0`}
          onError={() => setLoadError(true)}
        />
      )
    }
    return (
      <div
        className={`${dimension} rounded-full overflow-hidden bg-rpg-bg flex-shrink-0`}
        dangerouslySetInnerHTML={{ __html: session.avatarSvg }}
      />
    )
  }

  return (
    <div className={`${shellSize} rounded bg-rpg-bg-elevated flex items-center justify-center font-mono flex-shrink-0 ${pane.process.typing ? 'text-rpg-accent' : 'text-rpg-text-muted'}`}>
      {pane.process.type === 'shell' ? '$' : '>'}
    </div>
  )
})
