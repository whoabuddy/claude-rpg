/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RPG-inspired color palette
        'rpg': {
          'bg': '#0f0f1a',
          'card': '#1a1a2e',
          'border': '#2a2a4a',
          'accent': '#6366f1',
          'accent-dim': '#4f46e5',
          'xp': '#fbbf24',
          'success': '#22c55e',
          'error': '#ef4444',
          'working': '#3b82f6',
          'waiting': '#f59e0b',
          'idle': '#6b7280',
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
