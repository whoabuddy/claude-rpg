import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useConfirmAction } from '../useConfirmAction'

describe('useConfirmAction', () => {
  it('starts not confirming', () => {
    const onConfirm = mock(() => {})
    const { result } = renderHook(() => useConfirmAction(onConfirm))
    expect(result.current.confirming).toBe(false)
  })

  it('first click enters confirming state', () => {
    const onConfirm = mock(() => {})
    const { result } = renderHook(() => useConfirmAction(onConfirm))

    act(() => {
      result.current.handleClick()
    })

    expect(result.current.confirming).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('second click executes onConfirm', () => {
    const onConfirm = mock(() => {})
    const { result } = renderHook(() => useConfirmAction(onConfirm))

    // First click
    act(() => {
      result.current.handleClick()
    })

    // Second click
    act(() => {
      result.current.handleClick()
    })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(result.current.confirming).toBe(false)
  })

  it('auto-dismisses after timeout', async () => {
    const onConfirm = mock(() => {})
    const { result } = renderHook(() => useConfirmAction(onConfirm, 100)) // Use short timeout for test

    act(() => {
      result.current.handleClick()
    })

    expect(result.current.confirming).toBe(true)

    // Wait for auto-dismiss
    await waitFor(() => {
      expect(result.current.confirming).toBe(false)
    }, { timeout: 200 })

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('handleCancel resets confirming state', () => {
    const onConfirm = mock(() => {})
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

  it('clears auto-dismiss timer on cancel', async () => {
    const onConfirm = mock(() => {})
    const { result } = renderHook(() => useConfirmAction(onConfirm, 100))

    act(() => {
      result.current.handleClick()
    })

    act(() => {
      result.current.handleCancel()
    })

    // Wait past the timeout - should stay not confirming
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(result.current.confirming).toBe(false)
  })
})
