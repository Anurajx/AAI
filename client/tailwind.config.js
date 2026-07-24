/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aai: {
          dark: "#eef1f5",
          card: "#ffffff",
          surface: "#e8ecf1",
          navy: "#1a365d",
          blue: "#2c5282",
          blueHover: "#1a365d",
          accent: "#975a16",
          success: "#276749",
          error: "#9b2c2c",
          border: "#cbd5e0",
          foreground: "#1a202c",
          muted: "#4a5568",
          light: "#1a202c",
          header: "#0f2942",
        }
      },
      fontFamily: {
        sans: ["Source Sans 3", "Noto Sans Devanagari", "system-ui", "sans-serif"],
        display: ["Source Sans 3", "Noto Sans Devanagari", "system-ui", "sans-serif"],
      },
      boxShadow: {
        gov: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
}
