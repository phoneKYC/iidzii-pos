/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './*.tsx',
    './*.ts',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
      },
      fontFamily: {
        cairo: ['Cairo', 'Ubuntu Arabic', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
