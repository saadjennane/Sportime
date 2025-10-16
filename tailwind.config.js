import defaultTheme from 'tailwindcss/defaultTheme';
import { STADIUM_ENERGY_THEME } from './src/config/theme';

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
