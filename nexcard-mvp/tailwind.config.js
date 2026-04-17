/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        heading: ['Syne', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
