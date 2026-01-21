// Shared status constants for consistent theming across components

export const STATUS_LABELS: Record<string, string> = {
  idle: 'Ready',
  typing: 'Active',
  working: 'Working',
  waiting: 'Waiting',
  error: 'Error',
  shell: 'Shell',
  process: 'Running',
}

export const STATUS_THEME = {
  idle:    { border: 'border-rpg-border-dim', bg: 'bg-rpg-card',       indicator: 'bg-rpg-idle',    glow: '' },
  typing:  { border: 'border-rpg-active',     bg: 'bg-rpg-card',       indicator: 'bg-rpg-active',  glow: '' },
  working: { border: 'border-rpg-working',    bg: 'bg-rpg-card',       indicator: 'bg-rpg-working', glow: 'status-glow-working' },
  waiting: { border: 'border-rpg-waiting',    bg: 'status-bg-waiting', indicator: 'bg-rpg-waiting', glow: 'status-glow-waiting' },
  error:   { border: 'border-rpg-error',      bg: 'status-bg-error',   indicator: 'bg-rpg-error',   glow: 'status-glow-error' },
  process: { border: 'border-rpg-active',     bg: 'bg-rpg-card',       indicator: 'bg-rpg-active',  glow: '' },
} as const

export const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-rpg-idle',
  typing: 'bg-rpg-active',
  working: 'bg-rpg-working',
  waiting: 'bg-rpg-waiting',
  error: 'bg-rpg-error',
  shell: 'bg-rpg-idle',
  process: 'bg-rpg-active',
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

export function getStatusTheme(status: string) {
  return STATUS_THEME[status as keyof typeof STATUS_THEME] || STATUS_THEME.idle
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-rpg-idle'
}
