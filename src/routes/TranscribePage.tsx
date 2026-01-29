import { useState, useCallback, useRef } from 'react'

interface TranscribeResult {
  text: string
}

// Target sample rate for whisper.cpp (16kHz mono)
const TARGET_SAMPLE_RATE = 16000

/**
 * Encode audio samples to WAV format (16-bit PCM, 16kHz mono)
 * Reused from useVoiceInput.ts
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

export default function TranscribePage() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<TranscribeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (selectedFile: File) => {
    setError(null)
    setResult(null)
    setIsProcessing(true)

    try {
      // Decode audio to get raw samples
      const AudioContextClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported in this browser')
      }

      const audioContext = new AudioContextClass()
      const arrayBuffer = await selectedFile.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // Get mono channel data
      const samples = audioBuffer.getChannelData(0)

      // Encode as WAV
      const wavBuffer = encodeWav(samples, audioBuffer.sampleRate)

      // Close audio context
      await audioContext.close()

      // Send to server
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/wav',
        },
        body: wavBuffer,
      })

      const data = await response.json()

      if (!data.success || !data.data?.ok) {
        throw new Error(data.data?.error || data.error || 'Transcription failed')
      }

      setResult({ text: data.data.text || '' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process audio file'
      setError(message)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    processFile(selectedFile)
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const audioFile = files.find(f => f.type.startsWith('audio/'))

    if (audioFile) {
      handleFileSelect(audioFile)
    } else {
      setError('Please drop an audio file (wav, mp3, m4a, webm, ogg)')
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleCopyText = useCallback(() => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text)
    }
  }, [result])

  const handleRetry = useCallback(() => {
    if (file) {
      processFile(file)
    }
  }, [file, processFile])

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Audio Transcription</h1>
        <p className="text-gray-400">Upload an audio file to transcribe it using whisper.cpp</p>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClickUpload}
        className={`
          relative border-2 border-dashed rounded-lg p-12 mb-6 transition-all cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-lg text-gray-300 mb-2">
            {isDragging ? 'Drop audio file here' : 'Drag and drop an audio file'}
          </p>
          <p className="text-sm text-gray-500">
            or click to browse (wav, mp3, m4a, webm, ogg)
          </p>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-white">Processing audio...</p>
            </div>
          </div>
        )}
      </div>

      {/* File Info */}
      {file && !isProcessing && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">File</p>
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={handleClickUpload}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Choose Different File
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-red-400 font-medium mb-1">Error</p>
              <p className="text-red-300">{error}</p>
            </div>
            {file && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
          <div className="flex items-start justify-between mb-3">
            <p className="text-green-400 font-medium">Transcription Result</p>
            <button
              onClick={handleCopyText}
              className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-sm transition-colors"
            >
              Copy
            </button>
          </div>
          <textarea
            readOnly
            value={result.text}
            className="w-full h-48 p-3 bg-gray-900 text-white border border-gray-700 rounded font-mono text-sm resize-vertical focus:outline-none focus:border-green-500"
          />
        </div>
      )}
    </div>
  )
}
