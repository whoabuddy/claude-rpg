/**
 * Terminal Buffer
 *
 * Accumulates terminal output from tmux control mode streaming.
 * Provides efficient storage with line limits and change detection.
 */

// Strip ANSI escape codes for content analysis
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

export class TerminalBuffer {
  private buffer: string = ''
  private maxLength: number
  private lastHash: string = ''
  private lastUpdateTime: number = 0

  constructor(maxLength: number = 50000) {  // ~50KB per pane
    this.maxLength = maxLength
  }

  /**
   * Append new output to the buffer
   */
  append(data: string): void {
    this.buffer += data
    this.lastUpdateTime = Date.now()

    // Trim from the beginning if too large
    if (this.buffer.length > this.maxLength) {
      // Find a good break point (newline) near the trim point
      const trimPoint = this.buffer.length - this.maxLength
      const newlineAfterTrim = this.buffer.indexOf('\n', trimPoint)
      if (newlineAfterTrim !== -1 && newlineAfterTrim < trimPoint + 1000) {
        this.buffer = this.buffer.slice(newlineAfterTrim + 1)
      } else {
        this.buffer = this.buffer.slice(trimPoint)
      }
    }
  }

  /**
   * Get the full buffer content
   */
  getContent(): string {
    return this.buffer
  }

  /**
   * Get the last N lines (for display)
   */
  getLastLines(n: number = 30): string {
    const lines = this.buffer.split('\n')
    return lines.slice(-n).join('\n')
  }

  /**
   * Check if content has changed since last check
   */
  hasChanged(): boolean {
    const currentHash = this.computeHash()
    if (currentHash !== this.lastHash) {
      this.lastHash = currentHash
      return true
    }
    return false
  }

  /**
   * Get time since last update
   */
  getTimeSinceUpdate(): number {
    return Date.now() - this.lastUpdateTime
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = ''
    this.lastHash = ''
    this.lastUpdateTime = Date.now()
  }

  /**
   * Compute a simple hash for change detection
   */
  private computeHash(): string {
    // Hash last 1000 chars for efficiency
    const sample = this.buffer.slice(-1000)
    let hash = 0
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(16)
  }
}

/**
 * Manager for all pane terminal buffers
 */
export class TerminalBufferManager {
  private buffers: Map<string, TerminalBuffer> = new Map()
  private maxBufferAge: number = 300000  // 5 minutes - remove inactive buffers

  /**
   * Get or create buffer for a pane
   */
  getBuffer(paneId: string): TerminalBuffer {
    let buffer = this.buffers.get(paneId)
    if (!buffer) {
      buffer = new TerminalBuffer()
      this.buffers.set(paneId, buffer)
    }
    return buffer
  }

  /**
   * Append data to a pane's buffer
   */
  append(paneId: string, data: string): void {
    this.getBuffer(paneId).append(data)
  }

  /**
   * Get content for a pane
   */
  getContent(paneId: string): string {
    return this.getBuffer(paneId).getContent()
  }

  /**
   * Get last N lines for a pane
   */
  getLastLines(paneId: string, n: number = 30): string {
    return this.getBuffer(paneId).getLastLines(n)
  }

  /**
   * Check if a pane's content has changed
   */
  hasChanged(paneId: string): boolean {
    const buffer = this.buffers.get(paneId)
    return buffer ? buffer.hasChanged() : false
  }

  /**
   * Remove buffer for a pane
   */
  remove(paneId: string): void {
    this.buffers.delete(paneId)
  }

  /**
   * Clean up old/inactive buffers
   */
  cleanup(activePaneIds: Set<string>): void {
    const now = Date.now()
    for (const [paneId, buffer] of this.buffers) {
      // Remove if pane no longer exists
      if (!activePaneIds.has(paneId)) {
        this.buffers.delete(paneId)
        continue
      }

      // Remove if inactive for too long
      if (buffer.getTimeSinceUpdate() > this.maxBufferAge) {
        this.buffers.delete(paneId)
      }
    }
  }

  /**
   * Get all pane IDs with buffers
   */
  getPaneIds(): string[] {
    return Array.from(this.buffers.keys())
  }
}

// Singleton instance
let bufferManager: TerminalBufferManager | null = null

export function getBufferManager(): TerminalBufferManager {
  if (!bufferManager) {
    bufferManager = new TerminalBufferManager()
  }
  return bufferManager
}
