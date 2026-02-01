/**
 * Fast 64-bit hash function for terminal content
 *
 * Uses Bun's native Wyhash implementation for speed and collision resistance.
 * Returns a 16-character hexadecimal string representing a 64-bit hash.
 *
 * Collision probability:
 * - At 1M items: ~0.0000027% (2.7e-6%)
 * - At 100k items: ~0.00027% (2.7e-5%)
 * - At 10k items: ~0.000027% (2.7e-7%)
 *
 * Compare to 32-bit DJB2:
 * - At 77k items: ~50% collision probability (birthday paradox)
 * - At 100k items: ~70% collision probability
 *
 * @param content - Terminal content to hash
 * @returns 16-character hex string (64-bit hash)
 */
export function hashContent(content: string): string {
  const hash = Bun.hash(content)
  return hash.toString(16).padStart(16, '0')
}
