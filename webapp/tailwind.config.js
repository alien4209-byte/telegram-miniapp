/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep felt-table green — the game's "world" color
        felt: {
          950: "#0a2e22",
          900: "#0e3b2c",
          800: "#134a37",
          700: "#1a5c44",
        },
        // Warm brass/gold for trump + emphasis, echoes card-table trim
        brass: {
          400: "#e8c477",
          500: "#d4a94a",
          600: "#b8892f",
        },
        team1: {
          DEFAULT: "#c0392b",
          light: "#e57368",
        },
        team2: {
          DEFAULT: "#2563a8",
          light: "#5b9bd9",
        },
        parchment: "#f3ecd9",
      },
      fontFamily: {
        display: ["Vazirmatn", "sans-serif"],
        body: ["Vazirmatn", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05)",
        "card-lift": "0 10px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05)",
        felt: "inset 0 0 120px rgba(0,0,0,0.45)",
      },
      keyframes: {
        "deal-in": {
          "0%": { transform: "translateY(40px) scale(0.8)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "play-card": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(-60px) scale(1.05)", opacity: "1" },
        },
        "trick-collect": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.4) translateY(-30px)", opacity: "0" },
        },
        shimmer: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "deal-in": "deal-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "play-card": "play-card 0.28s cubic-bezier(0.22,1,0.36,1) both",
        "trick-collect": "trick-collect 0.45s ease-in both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "pop-in": "pop-in 0.25s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
