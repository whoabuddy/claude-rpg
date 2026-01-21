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
          // Base surfaces (warm brown)
          'bg': '#31291b',
          'card': '#3a3125',
          'border': '#5a4d3a',

          // Text hierarchy (cream/pale yellow)
          'text': '#f7f9d7',
          'text-dim': '#a09a7d',

          // Accent (warm amber)
          'accent': '#e6a857',
          'accent-dim': '#c4915e',

          // Semantic status colors
          'xp': '#ffc94a',        // Bright gold for XP display
          'success': '#4ecca3',   // Vibrant teal for success states
          'error': '#ff6b6b',     // Coral red for errors
          'working': '#5bcefa',   // Bright cyan - Claude actively processing
          'waiting': '#ff9f43',   // Vivid orange - needs user input (highest urgency)
          'active': '#f9ca24',    // Bright yellow-gold - user typing/activity
          'ready': '#9b8b6e',     // Warm taupe - stable, calm

          // UI elements (aliases for semantic clarity)
          'idle': '#9b8b6e',      // Alias for ready state
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
