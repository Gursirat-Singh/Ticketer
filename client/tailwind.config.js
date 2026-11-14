/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#101013', 900: '#17171b', 800: '#1e1e23', 700: '#2a2a31', 600: '#3a3a43' },
        paper: { DEFAULT: '#f3f0ea', dim: '#bdb9b0', mute: '#8f8c96' },
        accent: { DEFAULT: '#e8283a', hover: '#ff3d4f', deep: '#a8182a' },
        gold: '#d9a441',
        velvet: '#9d8cf2',
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'Impact', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: { lift: '0 18px 50px -20px rgba(0,0,0,0.8)' },
    },
  },
  plugins: [],
};
