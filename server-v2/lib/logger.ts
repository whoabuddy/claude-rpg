/**
 * Structured JSON logger with module context
 */

import { getConfig } from './config'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: Record<string, unknown>
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
}

function shouldLog(level: LogLevel): boolean {
  const config = getConfig()
  return LOG_LEVELS[level] >= LOG_LEVELS[config.logLevel]
}

function formatLog(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(data && { data }),
  }
  return JSON.stringify(entry)
}

function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return

  const output = formatLog(level, module, message, data)

  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

export function createLogger(module: string): Logger {
  return {
    debug: (message, data) => log('debug', module, message, data),
    info: (message, data) => log('info', module, message, data),
    warn: (message, data) => log('warn', module, message, data),
    error: (message, data) => log('error', module, message, data),
  }
}

// Root logger for general use
export const logger = createLogger('server')
