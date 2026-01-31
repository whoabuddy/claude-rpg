import { existsSync, unlinkSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { DEFAULTS } from '../../shared/defaults.js'
import { createLogger } from './logger'

const log = createLogger('whisper')

// Directory for failed audio backups (for debugging)
const FAILED_AUDIO_DIR = join(os.homedir(), '.claude-rpg', 'failed-audio')

/**
 * Check if whisper.cpp and the model are available
 */
export function isWhisperAvailable(): boolean {
  return existsSync(DEFAULTS.WHISPER_MODEL)
}

/**
 * Save audio file for debugging when transcription fails
 */
function saveFailedAudio(audioBuffer: Buffer): string | null {
  try {
    mkdirSync(FAILED_AUDIO_DIR, { recursive: true })

    // Keep only last 10 failed files
    const files = readdirSync(FAILED_AUDIO_DIR).sort()
    while (files.length >= 10) {
      const oldest = files.shift()
      if (oldest) unlinkSync(join(FAILED_AUDIO_DIR, oldest))
    }

    const filename = `failed-${Date.now()}.wav`
    const filepath = join(FAILED_AUDIO_DIR, filename)
    Bun.write(filepath, audioBuffer)
    return filepath
  } catch {
    return null
  }
}

/**
 * Transcribe audio buffer to text using whisper.cpp
 * @param audioBuffer - WAV audio data (16-bit PCM, 16kHz mono)
 * @returns Transcribed text
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  if (!isWhisperAvailable()) {
    throw new Error('Whisper model not found. Please install whisper.cpp and download the model.')
  }

  const startTime = Date.now()
  const audioSizeKB = Math.round(audioBuffer.length / 1024)

  // Write audio to temp file
  const tempFile = `/tmp/claude-rpg-audio-${Date.now()}.wav`
  await Bun.write(tempFile, audioBuffer)

  try {
    // Run whisper.cpp with optimized settings
    // -nt: no timestamps
    // -np: no progress
    // -t: thread count (use half of available cores)
    const threadCount = Math.max(1, Math.floor(os.cpus().length / 2))

    const proc = Bun.spawn(
      [
        'whisper',
        '-m', DEFAULTS.WHISPER_MODEL,
        '-f', tempFile,
        '-nt',
        '-np',
        '--no-prints',
        '-l', 'en',
        '-t', String(threadCount),
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      }
    )

    // Wait for process with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill()
        reject(new Error('Transcription timed out'))
      }, DEFAULTS.WHISPER_TIMEOUT_MS)
    })

    const resultPromise = (async () => {
      const exitCode = await proc.exited
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      if (exitCode !== 0) {
        throw new Error(`Whisper failed with exit code ${exitCode}: ${stderr}`)
      }

      return { stdout, stderr }
    })()

    const { stdout, stderr } = await Promise.race([resultPromise, timeoutPromise])

    // Clean up temp file
    unlinkSync(tempFile)

    const durationMs = Date.now() - startTime

    // Parse output - whisper outputs text directly
    const text = stdout.trim()

    if (!text) {
      if (stderr) {
        log.error('Whisper stderr output', { stderr, durationMs })
      } else {
        log.warn('Whisper returned empty text', { audioSizeKB, durationMs })
      }
    } else {
      log.info('Transcription complete', {
        textLength: text.length,
        audioSizeKB,
        durationMs,
      })
    }

    return text
  } catch (error) {
    const durationMs = Date.now() - startTime

    // Save failed audio for debugging
    const savedPath = saveFailedAudio(audioBuffer)

    log.error('Transcription failed', {
      error: error instanceof Error ? error.message : String(error),
      audioSizeKB,
      durationMs,
      savedPath,
    })

    // Clean up temp file on error
    try {
      unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
    }

    throw error
  }
}
