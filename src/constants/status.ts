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
  idle:    { border: 'border-rpg-border-dim', bg: 'bg-rpg-card',       indicator: 'bg-rpg-idle',    indicatorAnimated: 'bg-rpg-idle',                   glow: '' },
  typing:  { border: 'border-rpg-active',     bg: 'bg-rpg-card',       indicator: 'bg-rpg-active',  indicatorAnimated: 'bg-rpg-accent',                 glow: '' },
  working: { border: 'border-rpg-working',    bg: 'bg-rpg-card',       indicator: 'bg-rpg-working', indicatorAnimated: 'bg-yellow-400 animate-pulse',   glow: 'status-glow-working' },
  waiting: { border: 'border-rpg-waiting',    bg: 'status-bg-waiting', indicator: 'bg-rpg-waiting', indicatorAnimated: 'bg-rpg-waiting animate-pulse', glow: 'status-glow-waiting' },
  error:   { border: 'border-rpg-error',      bg: 'status-bg-error',   indicator: 'bg-rpg-error',   indicatorAnimated: 'bg-rpg-error',                  glow: 'status-glow-error' },
  shell:   { border: 'border-rpg-border-dim', bg: 'bg-rpg-card',       indicator: 'bg-rpg-idle',    indicatorAnimated: 'bg-rpg-idle',                   glow: '' },
  process: { border: 'border-rpg-active',     bg: 'bg-rpg-card',       indicator: 'bg-rpg-active',  indicatorAnimated: 'bg-rpg-active',                 glow: '' },
} as const

// Derive color from STATUS_THEME.indicator (single source of truth)
export function getStatusColor(status: string): string {
  const theme = STATUS_THEME[status as keyof typeof STATUS_THEME]
  return theme?.indicator || 'bg-rpg-idle'
}

// Get animated dot class (includes animate-pulse for working/waiting)
export function getStatusDotClass(status: string): string {
  const theme = STATUS_THEME[status as keyof typeof STATUS_THEME]
  return theme?.indicatorAnimated || 'bg-rpg-idle'
}
