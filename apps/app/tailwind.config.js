const { hairlineWidth } = require("nativewind/theme")

// Design tokens come from the selected theme (lib/themes.ts).
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: "hsl(var(--destructive))",
        "tone-rose": {
          DEFAULT: "hsl(var(--tone-rose))",
          foreground: "hsl(var(--tone-rose-foreground))",
        },
        "tone-sage": {
          DEFAULT: "hsl(var(--tone-sage))",
          foreground: "hsl(var(--tone-sage-foreground))",
        },
        "tone-peach": {
          DEFAULT: "hsl(var(--tone-peach))",
          foreground: "hsl(var(--tone-peach-foreground))",
        },
        "tone-lavender": {
          DEFAULT: "hsl(var(--tone-lavender))",
          foreground: "hsl(var(--tone-lavender-foreground))",
        },
        "tone-butter": {
          DEFAULT: "hsl(var(--tone-butter))",
          foreground: "hsl(var(--tone-butter-foreground))",
        },
        "tone-sky": {
          DEFAULT: "hsl(var(--tone-sky))",
          foreground: "hsl(var(--tone-sky-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 6px)",
      },
      borderWidth: { hairline: hairlineWidth() },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
