import { describe, it, expect, beforeEach } from 'vitest'
import { lastPromptByPane } from '../prompt-history'

describe('lastPromptByPane', () => {
  beforeEach(() => {
    lastPromptByPane.clear()
  })

  it('is a Map', () => {
    expect(lastPromptByPane).toBeInstanceOf(Map)
  })

  it('stores and retrieves prompts per pane', () => {
    lastPromptByPane.set('%1', 'fix the bug')
    lastPromptByPane.set('%2', 'add tests')

    expect(lastPromptByPane.get('%1')).toBe('fix the bug')
    expect(lastPromptByPane.get('%2')).toBe('add tests')
  })

  it('overwrites previous prompt for same pane', () => {
    lastPromptByPane.set('%1', 'first')
    lastPromptByPane.set('%1', 'second')

    expect(lastPromptByPane.get('%1')).toBe('second')
    expect(lastPromptByPane.size).toBe(1)
  })

  it('returns undefined for unknown pane', () => {
    expect(lastPromptByPane.get('%99')).toBeUndefined()
  })

  it('isolates prompts between panes', () => {
    lastPromptByPane.set('%1', 'prompt for pane 1')

    expect(lastPromptByPane.has('%1')).toBe(true)
    expect(lastPromptByPane.has('%2')).toBe(false)
  })

  it('supports deletion', () => {
    lastPromptByPane.set('%1', 'hello')
    lastPromptByPane.delete('%1')

    expect(lastPromptByPane.has('%1')).toBe(false)
  })
})
