import { describe, it, expect } from 'vitest'
import { getPaneStatus, paneEqual } from '../pane-status'
import type { TmuxPane } from '@shared/types'

function makePane(overrides: Partial<TmuxPane> = {}): TmuxPane {
  return {
    id: '%1',
    target: 'work:1.0',
    paneIndex: 0,
    isActive: true,
    cwd: '/home/user/project',
    process: {
      type: 'shell',
      command: 'bash',
      pid: 1234,
    },
    ...overrides,
  }
}

function makeClaudePane(status: string, overrides: Partial<TmuxPane> = {}): TmuxPane {
  return makePane({
    process: {
      type: 'claude',
      command: 'claude',
      pid: 5678,
      claudeSession: {
        id: 'session-1',
        name: 'Alice',
        status: status as TmuxPane['process']['claudeSession'] extends undefined ? never : NonNullable<TmuxPane['process']['claudeSession']>['status'],
        createdAt: Date.now(),
        lastActivity: Date.now(),
      },
    },
    ...overrides,
  })
}

describe('getPaneStatus', () => {
  it('returns session status for claude panes', () => {
    expect(getPaneStatus(makeClaudePane('idle'))).toBe('idle')
    expect(getPaneStatus(makeClaudePane('working'))).toBe('working')
    expect(getPaneStatus(makeClaudePane('waiting'))).toBe('waiting')
    expect(getPaneStatus(makeClaudePane('error'))).toBe('error')
    expect(getPaneStatus(makeClaudePane('typing'))).toBe('typing')
  })

  it('returns typing for shell panes with typing flag', () => {
    const pane = makePane({ process: { type: 'shell', command: 'bash', pid: 1, typing: true } })
    expect(getPaneStatus(pane)).toBe('typing')
  })

  it('returns process type for non-claude panes without typing', () => {
    expect(getPaneStatus(makePane())).toBe('shell')
    expect(getPaneStatus(makePane({ process: { type: 'process', command: 'node', pid: 1 } }))).toBe('process')
    expect(getPaneStatus(makePane({ process: { type: 'idle', command: '', pid: 0 } }))).toBe('idle')
  })
})

describe('paneEqual', () => {
  it('returns true for identical panes', () => {
    const pane = makePane()
    expect(paneEqual(pane, { ...pane })).toBe(true)
  })

  it('detects process type changes', () => {
    const a = makePane()
    const b = makePane({ process: { type: 'process', command: 'node', pid: 1 } })
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects typing changes', () => {
    const a = makePane()
    const b = makePane({ process: { type: 'shell', command: 'bash', pid: 1234, typing: true } })
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects cwd changes', () => {
    const a = makePane()
    const b = makePane({ cwd: '/other/path' })
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects claude session presence changes', () => {
    const a = makePane()
    const b = makeClaudePane('idle')
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects claude session status changes', () => {
    const a = makeClaudePane('idle')
    const b = makeClaudePane('working')
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects repo changes', () => {
    const a = makePane({ repo: { path: '/p', name: 'repo', branch: 'main' } })
    const b = makePane({ repo: { path: '/p', name: 'repo', branch: 'feature' } })
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects repo dirty flag changes', () => {
    const a = makePane({ repo: { path: '/p', name: 'repo', isDirty: false } })
    const b = makePane({ repo: { path: '/p', name: 'repo', isDirty: true } })
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects repo ahead/behind changes', () => {
    const a = makePane({ repo: { path: '/p', name: 'repo', ahead: 0, behind: 0 } })
    const b = makePane({ repo: { path: '/p', name: 'repo', ahead: 2, behind: 0 } })
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects terminal prompt changes', () => {
    const a = makeClaudePane('waiting')
    const b = makeClaudePane('waiting')
    a.process.claudeSession!.terminalPrompt = {
      type: 'permission',
      question: 'Allow?',
      options: [],
      multiSelect: false,
      detectedAt: 1,
      contentHash: 'hash1',
    }
    b.process.claudeSession!.terminalPrompt = {
      type: 'permission',
      question: 'Allow?',
      options: [],
      multiSelect: false,
      detectedAt: 2,
      contentHash: 'hash2',
    }
    expect(paneEqual(a, b)).toBe(false)
  })

  it('detects stats XP changes', () => {
    const a = makeClaudePane('idle')
    const b = makeClaudePane('idle')
    a.process.claudeSession!.stats = {
      totalXPGained: 10,
      toolsUsed: {},
      promptsReceived: 0,
      git: { commits: 0, pushes: 0, prsCreated: 0, prsMerged: 0 },
      commands: { testsRun: 0, buildsRun: 0 },
    }
    b.process.claudeSession!.stats = {
      totalXPGained: 20,
      toolsUsed: {},
      promptsReceived: 0,
      git: { commits: 0, pushes: 0, prsCreated: 0, prsMerged: 0 },
      commands: { testsRun: 0, buildsRun: 0 },
    }
    expect(paneEqual(a, b)).toBe(false)
  })
})
