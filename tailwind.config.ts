import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3faf7",
          100: "#d7f0e5",
          200: "#aee0cb",
          300: "#80ceaf",
          400: "#4ab88f",
          500: "#179d72",
          600: "#0f7e5b",
          700: "#0c644a",
          800: "#0b513d",
          900: "#0a4333"
        }
      }
    }
  },
  plugins: []
};

export default config;

