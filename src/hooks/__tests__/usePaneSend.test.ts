import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePaneSend } from '../usePaneSend'
import { lastPromptByPane } from '../../utils/prompt-history'

describe('usePaneSend', () => {
  const paneId = '%1'
  let mockSendPrompt: ReturnType<typeof vi.fn>

  beforeEach(() => {
    lastPromptByPane.clear()
    mockSendPrompt = vi.fn().mockResolvedValue({ ok: true })
  })

  it('initializes with empty input', () => {
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))
    expect(result.current.inputValue).toBe('')
    expect(result.current.isSending).toBe(false)
    expect(result.current.inlineError).toBeNull()
    expect(result.current.hasLastPrompt).toBe(false)
  })

  it('sends prompt and clears input on success', async () => {
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))

    act(() => {
      result.current.setInputValue('hello')
    })
    expect(result.current.inputValue).toBe('hello')

    await act(async () => {
      await result.current.handleSend()
    })

    expect(mockSendPrompt).toHaveBeenCalledWith(paneId, 'hello')
    expect(result.current.inputValue).toBe('')
    expect(result.current.isSending).toBe(false)
  })

  it('saves last prompt on success', async () => {
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))

    act(() => {
      result.current.setInputValue('test prompt')
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.hasLastPrompt).toBe(true)
    expect(lastPromptByPane.get(paneId)).toBe('test prompt')
  })

  it('shows inline error on failure and keeps input', async () => {
    mockSendPrompt.mockResolvedValue({ ok: false, error: 'Send failed' })
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))

    act(() => {
      result.current.setInputValue('will fail')
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.inputValue).toBe('will fail')
    expect(result.current.inlineError).toBe('Send failed')
  })

  it('restores last prompt', async () => {
    lastPromptByPane.set(paneId, 'saved prompt')
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))

    expect(result.current.hasLastPrompt).toBe(true)

    act(() => {
      result.current.handleRestoreLast()
    })

    expect(result.current.inputValue).toBe('saved prompt')
  })

  it('clears inline error manually', async () => {
    mockSendPrompt.mockResolvedValue({ ok: false, error: 'oops' })
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))

    act(() => {
      result.current.setInputValue('fail')
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.inlineError).toBe('oops')

    act(() => {
      result.current.clearInlineError()
    })

    expect(result.current.inlineError).toBeNull()
  })

  it('handleEnter sends empty string fire-and-forget', () => {
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))

    act(() => {
      result.current.handleEnter()
    })

    expect(mockSendPrompt).toHaveBeenCalledWith(paneId, '')
  })

  it('does not send if input is whitespace only', async () => {
    const { result } = renderHook(() => usePaneSend(paneId, mockSendPrompt))

    act(() => {
      result.current.setInputValue('   ')
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(mockSendPrompt).not.toHaveBeenCalled()
  })
})
