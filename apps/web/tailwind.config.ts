import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        glass: "0 10px 40px rgba(0,0,0,0.55)",
        glow: "0 0 40px rgba(124,58,237,0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;