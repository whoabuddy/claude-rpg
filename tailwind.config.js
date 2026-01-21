/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RPG color palette - warm earth tones with tetradic accents
        'rpg': {
          // Base surfaces (warm brown)
          'bg': '#31291b',
          'card': '#3d352a',
          'border': '#524736',

          // Text hierarchy (cream/pale yellow)
          'text': '#f7f9d7',
          'text-dim': '#a09a7d',

          // Accent (lavender - interactive elements)
          'accent': '#d9d7f9',
          'accent-dim': '#b8b5e6',

          // Semantic status colors
          'xp': '#f5d76e',        // Warm gold for XP
          'success': '#7ec9b8',   // Teal-green (harmonizes with cyan)
          'error': '#e57373',     // Soft red (harmonizes with pink)
          'working': '#d7f7f9',   // Cyan for active work
          'waiting': '#f9d9d7',   // Pink/salmon for attention
          'idle': '#8a7d6a',      // Muted brown
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'xp-gain': 'xpGain 0.6s ease-out',
        'level-up': 'levelUp 1s ease-out',
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
      },
    },
  },
  plugins: [],
}
