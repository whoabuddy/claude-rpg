/**
 * Sound effects hook
 */

import { useState, useEffect, useCallback } from 'react'
import { getSoundEnabled, setSoundEnabled, playSound, playSoundIfEnabled } from '../lib/sounds'

type SoundType = 'waiting' | 'complete' | 'error' | 'levelUp' | 'achievement' | 'xp'

interface UseSoundResult {
  soundEnabled: boolean
  toggleSound: () => void
  play: (type: SoundType) => void
  playIfEnabled: (type: SoundType) => void
}

export function useSound(): UseSoundResult {
  const [soundEnabled, setSoundEnabledState] = useState(false)

  // Load initial state from localStorage
  useEffect(() => {
    setSoundEnabledState(getSoundEnabled())
  }, [])

  const toggleSound = useCallback(() => {
    const newValue = !soundEnabled
    setSoundEnabledState(newValue)
    setSoundEnabled(newValue)

    // Play a test sound when enabling
    if (newValue) {
      playSound('xp')
    }
  }, [soundEnabled])

  const play = useCallback((type: SoundType) => {
    playSound(type)
  }, [])

  const playIfEnabled = useCallback((type: SoundType) => {
    playSoundIfEnabled(type)
  }, [])

  return { soundEnabled, toggleSound, play, playIfEnabled }
}
