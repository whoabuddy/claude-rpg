import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { DEFAULTS } from '../shared/defaults.js'

const execFileAsync = promisify(execFile)

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
  writeFileSync(tempFile, audioBuffer)

  try {
    // Run whisper.cpp
    // -nt: no timestamps
    // -np: no progress
    // -ml 1: max segment length 1 (output as single line)
    const { stdout, stderr } = await execFileAsync(
      'whisper',
      [
        '-m', DEFAULTS.WHISPER_MODEL,
        '-f', tempFile,
        '-nt',
        '-np',
        '--no-prints',
        '-l', 'en',
      ],
      { timeout: DEFAULTS.WHISPER_TIMEOUT_MS }
    )

    // Clean up temp file
    unlinkSync(tempFile)

    // Parse output - whisper outputs text directly
    const text = stdout.trim()
    if (!text && stderr) {
      console.error('[whisper] stderr:', stderr)
    }

    return text
  } catch (error) {
    // Clean up temp file on error
    try {
      unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
    }

    // Check for timeout (child_process sets killed=true and signal='SIGTERM' on timeout)
    const execError = error as { killed?: boolean; signal?: string; message?: string }
    if (execError.killed && execError.signal === 'SIGTERM') {
      throw new Error('Transcription timed out')
    }

    throw error
  }
}
