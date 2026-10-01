import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0A0D12",
        surface: {
          DEFAULT: "#11151C",
          elevated: "#171C24",
          hover: "#1D232D",
        },
        border: {
          DEFAULT: "#242B35",
          subtle: "#1C222B",
          strong: "#353E4D",
        },
        primary: {
          DEFAULT: "#5B8CFF",
          hover: "#4977E6",
          light: "#82A9FF",
          muted: "rgba(91, 140, 255, 0.15)",
        },
        foreground: {
          DEFAULT: "#F3F5F7",
          muted: "#8A94A3",
          subtle: "#5F6977",
        },
        status: {
          deliverable: "#10B981",
          undeliverable: "#EF4444",
          risky: "#F59E0B",
          catchall: "#EAB308",
          disposable: "#EC4899",
          role: "#8B5CF6",
          temporary: "#06B6D4",
          unknown: "#64748B",
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
