import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConfirmAction } from '../useConfirmAction'

describe('useConfirmAction', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts not confirming', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmAction(onConfirm))
    expect(result.current.confirming).toBe(false)
  })

  it('first click enters confirming state', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmAction(onConfirm))

    act(() => {
      result.current.handleClick()
    })

    expect(result.current.confirming).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('second click executes onConfirm', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmAction(onConfirm))

    // First click
    act(() => {
      result.current.handleClick()
    })

    // Second click
    act(() => {
      result.current.handleClick()
    })

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(result.current.confirming).toBe(false)
  })

  it('auto-dismisses after 3 seconds', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmAction(onConfirm))

    act(() => {
      result.current.handleClick()
    })

    expect(result.current.confirming).toBe(true)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.confirming).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('handleCancel resets confirming state', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmAction(onConfirm))

    act(() => {
      result.current.handleClick()
    })

    expect(result.current.confirming).toBe(true)

    act(() => {
      result.current.handleCancel()
    })

    expect(result.current.confirming).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('clears auto-dismiss timer on cancel', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmAction(onConfirm))

    act(() => {
      result.current.handleClick()
    })

    act(() => {
      result.current.handleCancel()
    })

    // Advance time past the 3 second mark - should not trigger anything
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.confirming).toBe(false)
  })
})
