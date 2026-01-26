import { memo } from 'react'
import type { TmuxPane } from '@shared/types'

interface PaneAvatarProps {
  pane: TmuxPane
  size?: 'sm' | 'md'
}

export const PaneAvatar = memo(function PaneAvatar({ pane, size = 'md' }: PaneAvatarProps) {
  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession

  const dimension = size === 'sm' ? 'w-6 h-6' : 'w-10 h-10'
  const fontSize = size === 'sm' ? 'text-xs' : 'text-base'
  const shellSize = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'

  if (isClaudePane && session) {
    if (session.avatarSvg) {
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
