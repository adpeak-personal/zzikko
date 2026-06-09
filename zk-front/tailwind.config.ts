import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["SUITE", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        "nanum-square": ["NanumSquare", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
