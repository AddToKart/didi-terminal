/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        plex: ['"IBM Plex Mono"', 'monospace'], // Keep for backward compatibility if needed in term
      },
      colors: {
        app: {
          bg: 'var(--app-bg)',
          panel: 'var(--app-panel)',
          border: 'var(--app-border)',
        },
        brand: {
          primary: '#e4e4e7', // zinc-200 (sharp white/gray contrast)
          accent: '#3b82f6', // blue-500 (modern clean blue)
          warn: '#ef4444', // red-500 (clean red for alerts)
        }
      },
      keyframes: {
        pulseBorder: {
          '0%, 100%': { borderColor: 'var(--tw-colors-brand-accent, #3b82f6)' },
          '50%': { borderColor: 'var(--tw-colors-app-border, #27272a)' },
        },
        flashBg: {
          '0%': { backgroundColor: 'rgba(59, 130, 246, 0.05)' },
          '100%': { backgroundColor: 'transparent' },
        }
      },
      animation: {
        'pulse-border': 'pulseBorder 1.5s ease-in-out 3',
        'flash-bg': 'flashBg 0.5s ease-out 1',
      }
    },
  },
  plugins: [],
}
