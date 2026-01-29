/**
 * Server configuration loaded from environment variables
 */

import { homedir } from 'os'
import { join } from 'path'

export interface Config {
  port: number
  dataDir: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  pollInterval: number
  wsHeartbeatInterval: number
  wsBackpressureHigh: number
  wsBackpressureLow: number
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

export function loadConfig(): Config {
  return {
    port: getEnvInt('PORT', 4011),
    dataDir: getEnv('DATA_DIR', join(homedir(), '.claude-rpg')),
    logLevel: getEnv('LOG_LEVEL', 'info') as Config['logLevel'],
    pollInterval: getEnvInt('POLL_INTERVAL', 250),
    wsHeartbeatInterval: getEnvInt('WS_HEARTBEAT_INTERVAL', 30000),
    wsBackpressureHigh: getEnvInt('WS_BACKPRESSURE_HIGH', 65536), // 64KB
    wsBackpressureLow: getEnvInt('WS_BACKPRESSURE_LOW', 16384),   // 16KB
  }
}

// Singleton config instance
let _config: Config | null = null

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig()
  }
  return _config
}

export function resetConfig(): void {
  _config = null
}
