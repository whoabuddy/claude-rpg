import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Hook for two-step confirmation pattern (click once to show confirm, click again to execute).
 * Auto-dismisses after 3 seconds if not confirmed.
 */
export function useConfirmAction(onConfirm: () => void) {
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
      }, 3000)
    }
  }, [confirming, onConfirm])

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
