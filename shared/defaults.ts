import { homedir } from 'os'
import { join } from 'path'

export const DEFAULTS = {
  SERVER_PORT: 4011,
  CLIENT_PORT: 4010,
  DATA_DIR: join(homedir(), '.claude-rpg', 'data'),
  HOOKS_DIR: join(homedir(), '.claude-rpg', 'hooks'),
  MODELS_DIR: join(homedir(), '.claude-rpg', 'models'),
  EVENTS_FILE: 'events.jsonl',
  COMPANIONS_FILE: 'companions.json',
  MAX_EVENTS: 1000,
  WHISPER_MODEL: join(homedir(), '.claude-rpg', 'models', 'ggml-base.en.bin'),
  WHISPER_TIMEOUT_MS: 30000,
  RPG_FEATURES: true,
}

export function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1))
  }
  return path
}
