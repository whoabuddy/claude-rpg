# Claude RPG Brand Guidelines

## Identity

- **Name**: Claude RPG
- **Tagline**: Mobile-first companion for Claude Code with RPG progression
- **Icon**: 👹 (japanese_ogre) - represents the playful, gamified nature

## Color Palette

### Surfaces (dark to light)
| Token | Hex | Use |
|-------|-----|-----|
| `rpg-bg` | `#1a1612` | Page background |
| `rpg-bg-elevated` | `#242019` | Raised surfaces |
| `rpg-card` | `#2d2820` | Card backgrounds |
| `rpg-card-hover` | `#3a342a` | Card hover state |
| `rpg-border` | `#4a4238` | Borders |
| `rpg-border-dim` | `#3a342a` | Subtle borders |

### Text
| Token | Hex | Use |
|-------|-----|-----|
| `rpg-text` | `#f5f5dc` | Primary text (beige) |
| `rpg-text-muted` | `#b8b0a0` | Secondary text |
| `rpg-text-dim` | `#7a7264` | Tertiary/disabled |

### Accent
| Token | Hex | Use |
|-------|-----|-----|
| `rpg-accent` | `#f0a848` | Primary accent (gold) |
| `rpg-accent-bright` | `#ffc060` | Hover/emphasis |
| `rpg-accent-dim` | `#c4915e` | Subtle accent |

### Status
| Token | Hex | Meaning |
|-------|-----|---------|
| `rpg-working` | `#5bcefa` | Claude actively processing |
| `rpg-waiting` | `#ff9f43` | Needs user input |
| `rpg-idle` | `#a09585` | Ready, awaiting prompt |
| `rpg-error` | `#ff6b6b` | Error state |
| `rpg-success` | `#4ecca3` | Success/complete |
| `rpg-xp` | `#ffd54f` | XP indicators |

### Medals (leaderboard)
| Token | Hex |
|-------|-----|
| `rpg-gold` | `#ffd700` |
| `rpg-silver` | `#c0c0c0` |
| `rpg-bronze` | `#cd7f32` |

## Typography

- **Font**: JetBrains Mono (fallback: Fira Code, monospace)
- **Style**: Monospace throughout for terminal aesthetic

## Status Indicators

| Status | Color | Glow | Animation |
|--------|-------|------|-----------|
| Working | Blue (`#5bcefa`) | Subtle | Pulse |
| Waiting | Amber (`#ff9f43`) | Strong | Pulse |
| Error | Red (`#ff6b6b`) | Strong | None |
| Idle | Gray (`#a09585`) | None | None |

## Design Principles

1. **Dark theme only** - Optimized for terminal users
2. **Warm earth tones** - Cozy RPG aesthetic
3. **Jewel accents** - Status colors pop against dark backgrounds
4. **Mobile-first** - Touch targets min 44px, responsive layout
5. **Minimal chrome** - Content-focused, reduce visual noise
