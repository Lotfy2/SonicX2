/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sonic-blue': '#3b82f6',
        'sonic-purple': '#8b5cf6',
        'sonic-dark': '#1f2937',
      },
    },
  },
  plugins: [],
}