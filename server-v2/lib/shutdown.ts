/**
 * Graceful shutdown handler
 */

import { createLogger } from './logger'

const log = createLogger('shutdown')

type ShutdownHandler = () => Promise<void> | void

interface RegisteredHandler {
  name: string
  handler: ShutdownHandler
  priority: number
}

const handlers: RegisteredHandler[] = []
let isShuttingDown = false
const SHUTDOWN_TIMEOUT = 10000 // 10 seconds

/**
 * Register a shutdown handler
 * @param name - Name for logging
 * @param handler - Async function to run on shutdown
 * @param priority - Higher runs first (default 0)
 */
export function onShutdown(name: string, handler: ShutdownHandler, priority = 0): void {
  handlers.push({ name, handler, priority })
  handlers.sort((a, b) => b.priority - a.priority)
}

/**
 * Execute all shutdown handlers
 */
async function executeShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress, ignoring signal', { signal })
    return
  }

  isShuttingDown = true
  log.info('Shutdown initiated', { signal, handlerCount: handlers.length })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT)
  })

  try {
    await Promise.race([
      runHandlers(),
      timeoutPromise,
    ])
    log.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    log.error('Shutdown failed or timed out', {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  }
}

async function runHandlers(): Promise<void> {
  for (const { name, handler } of handlers) {
    try {
      log.debug('Running shutdown handler', { name })
      await handler()
      log.debug('Shutdown handler completed', { name })
    } catch (error) {
      log.error('Shutdown handler failed', {
        name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Initialize shutdown signal handlers
 */
export function initShutdown(): void {
  process.on('SIGTERM', () => executeShutdown('SIGTERM'))
  process.on('SIGINT', () => executeShutdown('SIGINT'))

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception', { error: error.message, stack: error.stack })
    executeShutdown('uncaughtException')
  })

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', { reason: String(reason) })
    executeShutdown('unhandledRejection')
  })

  log.debug('Shutdown handlers initialized')
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown
}
