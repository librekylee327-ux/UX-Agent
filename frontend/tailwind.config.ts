import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d1d1f",
        graphite: "#707070",
        fog: "#f5f5f7",
        "silver-mist": "#e8e8ed",
        azure: "#0071e3",
        "cobalt-link": "#0066cc",
      },
      borderRadius: {
        "apple-card": "28px",
        "apple-pill": "999px",
        "apple-sm": "10px",
      },
    },
  },
  plugins: [],
};

export default config;
