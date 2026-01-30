import { existsSync, unlinkSync } from 'fs'
import { DEFAULTS } from '../../shared/defaults.js'
import { createLogger } from './logger'

const log = createLogger('whisper')

/**
 * Check if whisper.cpp and the model are available
 */
export function isWhisperAvailable(): boolean {
  return existsSync(DEFAULTS.WHISPER_MODEL)
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

  // Write audio to temp file
  const tempFile = `/tmp/claude-rpg-audio-${Date.now()}.wav`
  await Bun.write(tempFile, audioBuffer)

  try {
    // Run whisper.cpp
    // -nt: no timestamps
    // -np: no progress
    // -ml 1: max segment length 1 (output as single line)
    const proc = Bun.spawn(
      [
        'whisper',
        '-m', DEFAULTS.WHISPER_MODEL,
        '-f', tempFile,
        '-nt',
        '-np',
        '--no-prints',
        '-l', 'en',
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

    // Parse output - whisper outputs text directly
    const text = stdout.trim()
    if (!text && stderr) {
      log.error('Whisper stderr output', { stderr })
    }

    return text
  } catch (error) {
    // Clean up temp file on error
    try {
      unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
    }

    throw error
  }
}
