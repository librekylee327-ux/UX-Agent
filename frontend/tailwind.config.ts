import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: "#1E293B",
        border: "#334155",
        muted: "#94A3B8",
      },
    },
  },
  plugins: [],
};

export default config;
