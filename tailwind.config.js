/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Scan root index.html
    "./src/frontend/**/*.{js,ts,jsx,tsx}", // Scan frontend source files
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
