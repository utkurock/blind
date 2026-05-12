import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:     "rgb(var(--c-bg)     / <alpha-value>)",
        panel:  "rgb(var(--c-panel)  / <alpha-value>)",
        line:   "rgb(var(--c-line)   / <alpha-value>)",
        dim:    "rgb(var(--c-dim)    / <alpha-value>)",
        muted:  "rgb(var(--c-muted)  / <alpha-value>)",
        ink:    "rgb(var(--c-ink)    / <alpha-value>)",
        cream:  "rgb(var(--c-ink)    / <alpha-value>)",
        long:   "rgb(var(--c-long)   / <alpha-value>)",
        short:  "rgb(var(--c-short)  / <alpha-value>)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"],
        mono: ["ui-monospace", "Menlo", "Consolas", "monospace"],
        display: ["Archivo Black", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
