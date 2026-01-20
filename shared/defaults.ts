import { homedir } from 'os'
import { join } from 'path'

export const DEFAULTS = {
  SERVER_PORT: 4011,
  CLIENT_PORT: 4010,
  DATA_DIR: join(homedir(), '.claude-rpg', 'data'),
  HOOKS_DIR: join(homedir(), '.claude-rpg', 'hooks'),
  EVENTS_FILE: 'events.jsonl',
  COMPANIONS_FILE: 'companions.json',
  MAX_EVENTS: 1000,
}

export function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1))
  }
  return path
}
