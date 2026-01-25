/**
 * Tmux Control Mode Client
 *
 * Connects to tmux in control mode (-C) to receive real-time notifications
 * about pane output, session changes, etc. This replaces polling for
 * terminal content with streaming updates.
 *
 * Reference: man tmux → CONTROL MODE section
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

// Notification types from tmux control mode
export interface TmuxOutputNotification {
  type: 'output'
  paneId: string      // e.g., "%51"
  data: string        // Unescaped output data
}

export interface TmuxSessionChangedNotification {
  type: 'session-changed'
  sessionId: string
  sessionName: string
}

export interface TmuxSessionsChangedNotification {
  type: 'sessions-changed'
}

export interface TmuxLayoutChangeNotification {
  type: 'layout-change'
  windowId: string
  layout: string
}

export interface TmuxWindowNotification {
  type: 'window-add' | 'window-close'
  windowId: string
}

export interface TmuxPaneNotification {
  type: 'pane-exited' | 'pane-focus-in' | 'pane-focus-out'
  paneId: string
}

export type TmuxNotification =
  | TmuxOutputNotification
  | TmuxSessionChangedNotification
  | TmuxSessionsChangedNotification
  | TmuxLayoutChangeNotification
  | TmuxWindowNotification
  | TmuxPaneNotification

export interface TmuxControlClientEvents {
  notification: (notification: TmuxNotification) => void
  connected: () => void
  disconnected: (reason: string) => void
  error: (error: Error) => void
}

/**
 * Client for tmux control mode
 *
 * Usage:
 * ```
 * const client = new TmuxControlClient()
 * client.on('notification', (n) => console.log(n))
 * await client.connect()
 * ```
 */
export class TmuxControlClient extends EventEmitter {
  private process: ChildProcess | null = null
  private buffer: string = ''
  private connected: boolean = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelayMs: number = 1000

  /**
   * Connect to tmux in control mode
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }

    return new Promise((resolve, reject) => {
      try {
        // Spawn tmux in control mode
        // -C = control mode, attach-session attaches to existing session
        this.process = spawn('tmux', ['-C', 'attach-session'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        this.process.stdout?.on('data', (chunk: Buffer) => {
          this.buffer += chunk.toString()
          this.processBuffer()
        })

        this.process.stderr?.on('data', (chunk: Buffer) => {
          const error = chunk.toString().trim()
          if (error) {
            console.error('[tmux-control] stderr:', error)
          }
        })

        this.process.on('close', (code) => {
          this.connected = false
          const reason = code === 0 ? 'normal exit' : `exit code ${code}`
          this.emit('disconnected', reason)

          // Attempt reconnect if not intentional
          if (code !== 0) {
            this.scheduleReconnect()
          }
        })

        this.process.on('error', (err) => {
          this.connected = false
          this.emit('error', err)
          reject(err)
        })

        // Wait for initial %begin/%end to confirm connection
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 5000)

        const checkConnected = () => {
          if (this.connected) {
            clearTimeout(timeout)
            resolve()
          } else {
            setTimeout(checkConnected, 50)
          }
        }
        checkConnected()

      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Disconnect from tmux control mode
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.process) {
      this.process.kill()
      this.process = null
    }

    this.connected = false
    this.buffer = ''
  }

  /**
   * Send a command to tmux
   */
  sendCommand(cmd: string): void {
    if (!this.connected || !this.process?.stdin) {
      console.warn('[tmux-control] Not connected, cannot send command:', cmd)
      return
    }

    this.process.stdin.write(cmd + '\n')
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Process buffered data and emit notifications
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue

      // Handle %begin/%end blocks (command responses)
      if (line.startsWith('%begin ') || line.startsWith('%end ') || line.startsWith('%error ')) {
        if (!this.connected && line.startsWith('%end ')) {
          this.connected = true
          this.reconnectAttempts = 0
          this.emit('connected')
        }
        continue
      }

      // Parse notification
      const notification = this.parseLine(line)
      if (notification) {
        this.emit('notification', notification)
      }
    }
  }

  /**
   * Parse a control mode line into a notification
   */
  private parseLine(line: string): TmuxNotification | null {
    // %output pane-id value
    if (line.startsWith('%output ')) {
      const match = line.match(/^%output (%\d+) (.*)$/)
      if (match) {
        return {
          type: 'output',
          paneId: match[1],
          data: this.unescapeOutput(match[2]),
        }
      }
    }

    // %session-changed session-id name
    if (line.startsWith('%session-changed ')) {
      const match = line.match(/^%session-changed (\$\d+) (.+)$/)
      if (match) {
        return {
          type: 'session-changed',
          sessionId: match[1],
          sessionName: match[2],
        }
      }
    }

    // %sessions-changed
    if (line === '%sessions-changed') {
      return { type: 'sessions-changed' }
    }

    // %layout-change window-id layout visible-layout flags
    if (line.startsWith('%layout-change ')) {
      const match = line.match(/^%layout-change (@\d+) (\S+)/)
      if (match) {
        return {
          type: 'layout-change',
          windowId: match[1],
          layout: match[2],
        }
      }
    }

    // %window-add window-id
    if (line.startsWith('%window-add ')) {
      const match = line.match(/^%window-add (@\d+)/)
      if (match) {
        return {
          type: 'window-add',
          windowId: match[1],
        }
      }
    }

    // %window-close window-id
    if (line.startsWith('%window-close ')) {
      const match = line.match(/^%window-close (@\d+)/)
      if (match) {
        return {
          type: 'window-close',
          windowId: match[1],
        }
      }
    }

    // %pane-exited pane-id
    if (line.startsWith('%pane-exited ')) {
      const match = line.match(/^%pane-exited (%\d+)/)
      if (match) {
        return {
          type: 'pane-exited',
          paneId: match[1],
        }
      }
    }

    // Unhandled notification - log for debugging
    if (line.startsWith('%') && !line.startsWith('%begin') && !line.startsWith('%end')) {
      // Only log unknown notifications occasionally to avoid spam
      if (Math.random() < 0.01) {
        console.log('[tmux-control] Unhandled:', line.slice(0, 100))
      }
    }

    return null
  }

  /**
   * Unescape tmux control mode output
   * Converts octal escapes (\xxx) back to characters
   * Also handles escaped backslashes (\\)
   */
  private unescapeOutput(escaped: string): string {
    // First handle octal escapes: \033, \015, \012, etc.
    // The pattern matches a literal backslash followed by 1-3 octal digits
    let result = escaped.replace(/\\([0-7]{1,3})/g, (_, oct) => {
      const code = parseInt(oct, 8)
      return String.fromCharCode(code)
    })

    // Handle escaped backslashes
    result = result.replace(/\\\\/g, '\\')

    return result
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[tmux-control] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelayMs * this.reconnectAttempts

    console.log(`[tmux-control] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null  // Clear before async operation
      this.connect().catch((err) => {
        console.error('[tmux-control] Reconnect failed:', err.message)
      })
    }, delay)
  }
}

// Singleton instance for the application
let controlClient: TmuxControlClient | null = null

export function getControlClient(): TmuxControlClient {
  if (!controlClient) {
    controlClient = new TmuxControlClient()
  }
  return controlClient
}
