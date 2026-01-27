import type { TmuxPane } from '@shared/types'

/** Derive display status string from a pane */
export function getPaneStatus(pane: TmuxPane): string {
  const isClaudePane = pane.process.type === 'claude'
  const session = pane.process.claudeSession
  if (isClaudePane && session) return session.status
  if (pane.process.typing) return 'typing'
  return pane.process.type
}

/** Shallow equality check for pane fields that affect rendering */
export function paneEqual(a: TmuxPane, b: TmuxPane): boolean {
  if (a.id !== b.id) return false
  if (a.process.type !== b.process.type) return false
  if (a.process.typing !== b.process.typing) return false
  if (a.process.command !== b.process.command) return false
  if (a.cwd !== b.cwd) return false
  const sa = a.process.claudeSession, sb = b.process.claudeSession
  if (!!sa !== !!sb) return false
  if (sa && sb) {
    if (sa.status !== sb.status) return false
    if (sa.name !== sb.name) return false
    if (sa.avatarSvg !== sb.avatarSvg) return false
    if (sa.currentTool !== sb.currentTool) return false
    if (sa.currentFile !== sb.currentFile) return false
    if (sa.lastPrompt !== sb.lastPrompt) return false
    if (!!sa.pendingQuestion !== !!sb.pendingQuestion) return false
    if (sa.pendingQuestion?.toolUseId !== sb.pendingQuestion?.toolUseId) return false
    if (!!sa.terminalPrompt !== !!sb.terminalPrompt) return false
    if (sa.terminalPrompt?.contentHash !== sb.terminalPrompt?.contentHash) return false
    if (sa.lastError?.timestamp !== sb.lastError?.timestamp) return false
    if (sa.stats?.totalXPGained !== sb.stats?.totalXPGained) return false
    const subSigA = sa.activeSubagents?.map(s => s.id).join('|') ?? ''
    const subSigB = sb.activeSubagents?.map(s => s.id).join('|') ?? ''
    if (subSigA !== subSigB) return false
  }
  if (a.repo?.name !== b.repo?.name) return false
  if (a.repo?.org !== b.repo?.org) return false
  if (a.repo?.branch !== b.repo?.branch) return false
  if (a.repo?.isDirty !== b.repo?.isDirty) return false
  if (a.repo?.ahead !== b.repo?.ahead) return false
  if (a.repo?.behind !== b.repo?.behind) return false
  return true
}
