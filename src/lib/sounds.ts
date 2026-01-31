/**
 * Sound effects using Web Audio API
 * Synthesized sounds - no external files needed
 */

type SoundType = 'waiting' | 'complete' | 'error' | 'levelUp' | 'achievement' | 'xp'

// AudioContext singleton
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    try {
      audioContext = new AudioContext()
    } catch {
      console.warn('[claude-rpg] Web Audio API not supported')
      return null
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

/**
 * Play a synthesized notification sound
 */
export function playSound(type: SoundType): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  switch (type) {
    case 'waiting':
      // Two-tone chime (attention needed)
      playTone(ctx, 880, 0.1, now, 0.15)        // A5
      playTone(ctx, 1174.66, 0.1, now + 0.12, 0.2)  // D6
      break

    case 'complete':
      // Upward arpeggio (task done)
      playTone(ctx, 523.25, 0.08, now, 0.1)       // C5
      playTone(ctx, 659.25, 0.08, now + 0.08, 0.1) // E5
      playTone(ctx, 783.99, 0.12, now + 0.16, 0.15) // G5
      break

    case 'error':
      // Low buzz (problem)
      playTone(ctx, 220, 0.15, now, 0.1, 'square')
      playTone(ctx, 196, 0.15, now + 0.15, 0.1, 'square')
      break

    case 'levelUp':
      // Triumphant fanfare
      playTone(ctx, 523.25, 0.1, now, 0.15)        // C5
      playTone(ctx, 659.25, 0.1, now + 0.1, 0.15)   // E5
      playTone(ctx, 783.99, 0.1, now + 0.2, 0.15)   // G5
      playTone(ctx, 1046.50, 0.2, now + 0.3, 0.25)  // C6
      break

    case 'achievement':
      // Sparkle sound
      playTone(ctx, 1318.51, 0.05, now, 0.1)        // E6
      playTone(ctx, 1567.98, 0.05, now + 0.05, 0.1) // G6
      playTone(ctx, 2093.00, 0.1, now + 0.1, 0.15)  // C7
      playTone(ctx, 1567.98, 0.05, now + 0.2, 0.08) // G6
      break

    case 'xp':
      // Quick coin sound
      playTone(ctx, 987.77, 0.05, now, 0.08)     // B5
      playTone(ctx, 1318.51, 0.08, now + 0.05, 0.1) // E6
      break
  }
}

/**
 * Play a single tone
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  startTime: number,
  volume: number = 0.1,
  type: OscillatorType = 'sine'
): void {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.value = frequency

  // Envelope: quick attack, smooth release
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.05)
}

// Settings persistence
const SOUND_ENABLED_KEY = 'claude-rpg-sound-enabled'

export function getSoundEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(SOUND_ENABLED_KEY) === 'true'
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false')
}

/**
 * Play a sound if sound is enabled
 */
export function playSoundIfEnabled(type: SoundType): void {
  if (getSoundEnabled()) {
    playSound(type)
  }
}
