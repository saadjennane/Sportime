import defaultTheme from 'tailwindcss/defaultTheme';

const STADIUM_ENERGY_THEME = {
  'electric-blue': '#1E90FF',
  'warm-yellow': '#FFBA08',
  'deep-navy': '#0A0C10',
  'navy-accent': '#11151A',
  'neon-cyan': '#00D1FF',
  'lime-glow': '#4AF626',
  'hot-red': '#FF3355',
  'text-primary': '#FFFFFF',
  'text-secondary': '#B0C7E8',
  'text-disabled': '#7D8B99',
  'disabled': '#3A3F47',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: STADIUM_ENERGY_THEME,
      fontFamily: {
        sans: ['Poppins', ...defaultTheme.fontFamily.sans],
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 209, 255, 0.5), 0 0 10px rgba(0, 209, 255, 0.3)' },
          '50%': { boxShadow: '0 0 15px rgba(0, 209, 255, 0.7), 0 0 25px rgba(0, 209, 255, 0.5)' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
