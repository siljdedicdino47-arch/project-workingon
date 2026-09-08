/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#EEF0EA',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#1E2723',
          muted: '#5B655F',
          faint: '#8B948D',
        },
        line: '#D9DCD3',
        accent: {
          DEFAULT: '#3D6B63',
          soft: '#E3ECE8',
          strong: '#2B4D47',
        },
        flag: {
          good: '#2F7D5A',
          'good-soft': '#E4F1EA',
          warn: '#A9762E',
          'warn-soft': '#F5EBDA',
          risk: '#AE3B3B',
          'risk-soft': '#F6E4E2',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
};
