import { useState, useRef, useEffect, useCallback } from 'react'

const DEFAULT_TIMEOUT = 3000

/**
 * Hook for two-step confirmation pattern (click once to show confirm, click again to execute).
 * Auto-dismisses after timeout (default 3 seconds) if not confirmed.
 */
export function useConfirmAction(onConfirm: () => void, timeout = DEFAULT_TIMEOUT) {
  const [confirming, setConfirming] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = useCallback(() => {
    if (confirming) {
      onConfirm()
      setConfirming(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    } else {
      setConfirming(true)
      timeoutRef.current = setTimeout(() => {
        setConfirming(false)
        timeoutRef.current = null
      }, timeout)
    }
  }, [confirming, onConfirm, timeout])

  const handleCancel = useCallback(() => {
    setConfirming(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { confirming, handleClick, handleCancel }
}
