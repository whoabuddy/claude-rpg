import { useState, useRef, useCallback, useEffect } from 'react'
import { encodeWav, TARGET_SAMPLE_RATE } from '../lib/audio'

// localStorage key for audio backup
const AUDIO_BACKUP_KEY = 'claude-rpg-voice-backup'

/**
 * Store audio blob in localStorage for crash recovery.
 * Note: localStorage has limited capacity (~5MB), adequate for short voice clips.
 */
async function backupAudioBlob(blob: Blob): Promise<void> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    localStorage.setItem(AUDIO_BACKUP_KEY, JSON.stringify({
      data: Array.from(new Uint8Array(arrayBuffer)),
      type: blob.type,
      timestamp: Date.now(),
    }))
  } catch {
    // Silently fail - backup is best-effort
    console.warn('[claude-rpg] Failed to backup audio')
  }
}

/**
 * Clear audio backup after successful transcription
 */
function clearAudioBackup(): void {
  try {
    localStorage.removeItem(AUDIO_BACKUP_KEY)
  } catch {
    // Ignore
  }
}

/**
 * Retrieve backed up audio blob if exists and recent (< 5 min)
 */
export function getBackedUpAudio(): Blob | null {
  try {
    const stored = localStorage.getItem(AUDIO_BACKUP_KEY)
    if (!stored) return null

    const { data, type, timestamp } = JSON.parse(stored)

    // Only restore if less than 5 minutes old
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      clearAudioBackup()
      return null
    }

    return new Blob([new Uint8Array(data)], { type })
  } catch {
    return null
  }
}

interface UseVoiceInputReturn {
  isRecording: boolean
  isProcessing: boolean
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<string>
  cancelRecording: () => void
}

/**
 * Check if voice recording is supported in this browser
 */
function isVoiceSupported(): { supported: boolean; reason?: string } {
  if (typeof navigator === 'undefined') {
    return { supported: false, reason: 'Navigator not available' }
  }
  if (!navigator.mediaDevices) {
    return { supported: false, reason: 'MediaDevices not available (requires HTTPS)' }
  }
  if (!navigator.mediaDevices.getUserMedia) {
    return { supported: false, reason: 'getUserMedia not supported' }
  }
  if (typeof MediaRecorder === 'undefined') {
    return { supported: false, reason: 'MediaRecorder not supported' }
  }
  if (typeof AudioContext === 'undefined' && typeof (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === 'undefined') {
    return { supported: false, reason: 'AudioContext not supported' }
  }
  return { supported: true }
}

/**
 * Get a supported mimeType for MediaRecorder
 * Prioritizes formats by transcription quality and browser support
 */
function getSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return undefined
  }

  // Order matters: prefer opus for quality, mp4 for Safari compatibility
  const types = [
    'audio/webm;codecs=opus',  // Chrome, Firefox, Edge
    'audio/webm',               // Fallback webm
    'audio/mp4',                // Safari (iOS and macOS)
    'audio/ogg;codecs=opus',    // Firefox alternative
    'audio/wav',                // Last resort
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return undefined
}

/**
 * Get a human-readable error message for getUserMedia errors
 */
function getMediaErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Failed to access microphone'

  // Handle specific DOMException types
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'Microphone permission denied. Please allow access in your browser settings.'
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No microphone found. Please connect a microphone and try again.'
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Microphone is in use by another application.'
  }
  if (error.name === 'OverconstrainedError') {
    return 'Microphone does not support required audio settings.'
  }
  if (error.name === 'SecurityError') {
    return 'Microphone access blocked. This page must be served over HTTPS.'
  }

  return error.message || 'Failed to access microphone'
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)

    // Check browser support
    const support = isVoiceSupported()
    if (!support.supported) {
      const msg = support.reason || 'Voice input not supported'
      setError(msg)
      throw new Error(msg)
    }

    try {
      // Request microphone permission with flexible constraints
      // Use 'ideal' instead of exact values for better cross-browser/device support
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: TARGET_SAMPLE_RATE },  // Will accept any rate, resamples later
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },  // Helps normalize volume levels
        },
      })
      streamRef.current = stream

      // Find supported mimeType
      const mimeType = getSupportedMimeType()

      // Create MediaRecorder (with or without mimeType option)
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
    } catch (err) {
      const message = getMediaErrorMessage(err)
      setError(message)
      throw err
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<string> => {
    if (!mediaRecorderRef.current || !streamRef.current) {
      throw new Error('No recording in progress')
    }

    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current!
      const recordedMimeType = mediaRecorder.mimeType || 'audio/webm'

      mediaRecorder.onstop = async () => {
        setIsRecording(false)
        setIsProcessing(true)

        // Stop all tracks
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null

        try {
          // Convert recorded chunks to WAV
          const blob = new Blob(chunksRef.current, { type: recordedMimeType })
          chunksRef.current = []

          // Store blob for potential retry (localStorage backup)
          await backupAudioBlob(blob)

          // Decode audio to get raw samples (with webkitAudioContext fallback)
          const AudioContextClass = window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          if (!AudioContextClass) {
            throw new Error('AudioContext not supported')
          }

          const audioContext = new AudioContextClass()
          audioContextRef.current = audioContext

          // Resume AudioContext if suspended (required for iOS Safari)
          if (audioContext.state === 'suspended') {
            await audioContext.resume()
          }

          const arrayBuffer = await blob.arrayBuffer()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

          // Get mono channel data
          const samples = audioBuffer.getChannelData(0)

          // Encode as WAV
          const wavBuffer = encodeWav(samples, audioBuffer.sampleRate)

          // Close audio context
          await audioContext.close()
          audioContextRef.current = null

          // Send to server
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'audio/wav',
            },
            body: wavBuffer,
          })

          const data = await response.json()

          setIsProcessing(false)

          if (!data.ok) {
            const errorMsg = data.error || 'Transcription failed'
            setError(errorMsg)
            reject(new Error(errorMsg))
            return
          }

          // Success - clear backup
          clearAudioBackup()
          resolve(data.text || '')
        } catch (err) {
          // Clean up AudioContext if it was created
          if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {})
            audioContextRef.current = null
          }
          chunksRef.current = []
          setIsProcessing(false)
          const message = err instanceof Error ? err.message : 'Failed to process audio'
          setError(message)
          reject(err)
        }
      }

      mediaRecorder.stop()
    })
  }, [])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      chunksRef.current = []
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    setIsRecording(false)
    setIsProcessing(false)
    setError(null)
  }, [isRecording])

  // Cleanup on unmount to prevent resource leaks
  useEffect(() => {
    return () => {
      // Stop any active media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      // Clear recorder
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop()
          } catch {
            // Ignore errors if already stopped
          }
        }
        mediaRecorderRef.current = null
      }
      chunksRef.current = []
    }
  }, [])

  return {
    isRecording,
    isProcessing,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
