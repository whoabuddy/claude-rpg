/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RPG color palette - warm earth tones with vibrant jewel accents
        'rpg': {
          // === SURFACE HIERARCHY (darker backgrounds for more contrast) ===
          'bg': '#1a1612',
          'bg-elevated': '#242019',
          'card': '#2d2820',
          'card-hover': '#3a342a',
          'border': '#4a4238',
          'border-dim': '#3a342a',

          // === TEXT HIERARCHY (brighter for readability) ===
          'text': '#f5f5dc',
          'text-muted': '#b8b0a0',
          'text-dim': '#7a7264',

          // === ACCENTS ===
          'accent': '#f0a848',
          'accent-bright': '#ffc060',
          'accent-dim': '#c4915e',

          // === STATUS (semantic colors) ===
          'xp': '#ffd54f',
          'success': '#4ecca3',
          'error': '#ff6b6b',
          'working': '#5bcefa',
          'waiting': '#ff9f43',
          'active': '#f9ca24',
          'idle': '#a09585',

          // === MEDALS (for leaderboard consistency) ===
          'gold': '#ffd700',
          'gold-dim': '#daa520',
          'silver': '#c0c0c0',
          'silver-dim': '#a8a8a8',
          'bronze': '#cd7f32',
          'bronze-dim': '#8b4513',

          // === EFFECTS ===
          'streak': '#ff6b35',
          'streak-inner': '#ffd93d',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'xp-gain': 'xpGain 0.6s ease-out',
        'level-up': 'levelUp 1s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        xpGain: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-20px) scale(1.2)', opacity: '0' },
        },
        levelUp: {
          '0%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.1)', filter: 'brightness(1.5)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
