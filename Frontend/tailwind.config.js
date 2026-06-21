/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm DairyStream light theme surfaces
        surface: "#FFFDF8",
        background: "#FAFAF7",
        border: "#EDE8DF",

        // Text system
        text: {
          primary: "#2C1A0E",
          secondary: "#8B7355",
          muted: "#C4A882",
        },

        // Brand colors
        brand: {
          DEFAULT: "#B8641A",
          hover: "#9E5415",
          soft: "#FDE9C9",
        },

        // Status colors
        success: {
          DEFAULT: "#22C55E",
          soft: "#ECFDF5",
        },
        warning: {
          soft: "#FFF7ED",
        },
      },

      boxShadow: {
        // Card shadow used across dashboard
        card: "0 18px 45px rgba(92, 61, 30, 0.08)",
      },

      borderRadius: {
        card: "1rem",   // same as your dashboard cards
      },
    },
  },
  plugins: [],
};
