import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Galaxy.ai-inspired palette
        brand: {
          DEFAULT: "#6d5efc", // primary purple (Run button)
          600: "#5b4ef0",
          700: "#4a3fd4",
        },
        edge: {
          image: "#3b82f6", // blue (image connections)
          text: "#f59e0b", // orange/amber (text connections)
        },
        canvasbg: "#f7f7f8",
      },
      boxShadow: {
        node: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.1)",
        "node-hover": "0 4px 12px rgba(16,24,40,0.12)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(109,94,252,0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(109,94,252,0)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
