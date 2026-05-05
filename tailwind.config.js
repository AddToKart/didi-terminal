/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        plex: ['"IBM Plex Mono"', 'monospace'],
        jetbrains: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        app: {
          bg: '#050505',
          panel: '#0a0a0c',
          border: '#18181b',
        },
        brand: {
          cyan: '#00f0ff',
          amber: '#ffb000',
        }
      },
      keyframes: {
        pulseBorder: {
          '0%, 100%': { borderColor: 'var(--tw-colors-brand-cyan, #00f0ff)' },
          '50%': { borderColor: 'var(--tw-colors-app-border, #18181b)' },
        },
        flashBg: {
          '0%': { backgroundColor: 'rgba(0, 240, 255, 0.1)' },
          '100%': { backgroundColor: 'transparent' },
        }
      },
      animation: {
        'pulse-border': 'pulseBorder 1s ease-in-out 3',
        'flash-bg': 'flashBg 0.5s ease-out 1',
      }
    },
  },
  plugins: [],
}
