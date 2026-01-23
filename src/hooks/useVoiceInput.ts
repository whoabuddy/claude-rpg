import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceInputReturn {
  isRecording: boolean
  isProcessing: boolean
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<string>
  cancelRecording: () => void
}

// Target sample rate for whisper.cpp (16kHz mono)
const TARGET_SAMPLE_RATE = 16000

/**
 * Encode audio samples to WAV format (16-bit PCM, 16kHz mono)
 * Note: Uses nearest-neighbor resampling which is acceptable for voice transcription
 */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const targetSampleRate = TARGET_SAMPLE_RATE

  // Resample to 16kHz if needed
  let resampled: Float32Array
  if (sampleRate !== targetSampleRate) {
    const ratio = sampleRate / targetSampleRate
    const newLength = Math.round(samples.length / ratio)
    resampled = new Float32Array(newLength)
    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.floor(i * ratio)
      resampled[i] = samples[srcIndex]
    }
  } else {
    resampled = samples
  }

  // Convert to 16-bit PCM
  const numSamples = resampled.length
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size (PCM)
  view.setUint16(20, 1, true) // AudioFormat (PCM)
  view.setUint16(22, 1, true) // NumChannels (mono)
  view.setUint32(24, targetSampleRate, true) // SampleRate
  view.setUint32(28, targetSampleRate * 2, true) // ByteRate
  view.setUint16(32, 2, true) // BlockAlign
  view.setUint16(34, 16, true) // BitsPerSample
  writeString(36, 'data')
  view.setUint32(40, numSamples * 2, true) // Subchunk2Size

  // Write PCM samples
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, resampled[i]))
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return buffer
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
 */
function getSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return undefined
  }

  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return undefined
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
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
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
      const message = err instanceof Error ? err.message : 'Failed to access microphone'
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

          // Decode audio to get raw samples (with webkitAudioContext fallback)
          const AudioContextClass = window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          if (!AudioContextClass) {
            throw new Error('AudioContext not supported')
          }

          const audioContext = new AudioContextClass()
          audioContextRef.current = audioContext

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
      audioContextRef.current.close()
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
