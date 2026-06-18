/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f4f6fe',
          100: '#e9edfd',
          200: '#d3dbfb',
          300: '#adbdf8',
          400: '#7e96f3',
          500: '#546feb',
          600: '#3c4edc',
          700: '#303cbd',
          800: '#2a339b',
          900: '#272f7c',
          950: '#1b1f4b',
        }
      }
    },
  },
  plugins: [],
}
