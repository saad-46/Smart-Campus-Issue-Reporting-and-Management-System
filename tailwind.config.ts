// tailwind.config.ts
import type { Config } from "tailwindcss";

export default <Config>{
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./types/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6366F1", // indigo-500
        secondary: "#4B5563", // gray-700
        success: "#10B981", // emerald-500
        danger: "#EF4444", // red-500
        warning: "#F59E0B", // amber-500
        "priority-high": "#EF4444",
        "priority-medium": "#F59E0B",
        "priority-low": "#10B981",
      },
      borderRadius: {
        xl: "1rem",
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.1)",
        "card-hover": "0 6px 16px rgba(0,0,0,0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 0 rgba(99,102,241,0)" },
          "50%": { boxShadow: "0 0 12px rgba(99,102,241,0.6)" },
        },
      },
      spacing: {
        "9": "2.25rem",
        "15": "3.75rem",
        "18": "4.5rem",
      },
    },
  },
  plugins: [],
};
