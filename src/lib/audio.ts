/**
 * Audio utility functions for voice transcription
 */

// Target sample rate for whisper.cpp (16kHz mono)
export const TARGET_SAMPLE_RATE = 16000

/**
 * Encode audio samples to WAV format (16-bit PCM, 16kHz mono)
 * Uses nearest-neighbor resampling which is acceptable for voice transcription
 */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
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
