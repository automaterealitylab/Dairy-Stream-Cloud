/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        surface: "#FFFFFF",
        background: "#F8FAFC",   // dashboard + login background
        border: "#E5E7EB",

        // Text system
        text: {
          primary: "#0F172A",
          secondary: "#64748B",
          muted: "#94A3B8",
        },

        // Brand colors (from dashboard)
        brand: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          soft: "#EFF6FF",
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
        card: "0 8px 30px rgba(15, 23, 42, 0.06)",
      },

      borderRadius: {
        card: "1rem",   // same as your dashboard cards
      },
    },
  },
  plugins: [],
};
