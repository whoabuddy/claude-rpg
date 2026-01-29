import { memo } from 'react'
import type { TmuxPane } from '@shared/types'

interface PaneAvatarProps {
  pane: TmuxPane
  size?: 'sm' | 'md' | 'lg'
}

export const PaneAvatar = memo(function PaneAvatar({ pane, size = 'md' }: PaneAvatarProps) {
  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession

  const dimensions = {
    sm: { avatar: 'w-6 h-6', font: 'text-xs', shell: 'w-6 h-6 text-xs' },
    md: { avatar: 'w-10 h-10', font: 'text-base', shell: 'w-8 h-8 text-sm' },
    lg: { avatar: 'w-12 h-12', font: 'text-lg', shell: 'w-10 h-10 text-base' },
  }
  const { avatar: dimension, font: fontSize, shell: shellSize } = dimensions[size]

  if (isClaudePane && session) {
    if (session.avatarSvg) {
      // Check if it's a URL or inline SVG
      const isUrl = session.avatarSvg.startsWith('http')
      if (isUrl) {
        return (
          <img
            src={session.avatarSvg}
            alt={session.name}
            className={`${dimension} rounded-full bg-rpg-bg flex-shrink-0`}
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
      <div className={`${dimension} rounded-full bg-rpg-accent/30 flex items-center justify-center ${fontSize} font-bold flex-shrink-0`}>
        {session.name[0]}
      </div>
    )
  }

  return (
    <div className={`${shellSize} rounded bg-rpg-bg-elevated flex items-center justify-center font-mono flex-shrink-0 ${pane.process.typing ? 'text-rpg-accent' : 'text-rpg-text-muted'}`}>
      {pane.process.type === 'shell' ? '$' : '>'}
    </div>
  )
})
