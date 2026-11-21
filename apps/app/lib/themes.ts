/**
 * Themes. A theme is a named set of design tokens plus a heading font and an icon
 * style, with a light and a dark variant. Screens never contain colours: they use
 * Tailwind classes such as `bg-card` or `text-tone-rose-foreground`, which read the
 * tokens below. To add a theme, add one definition to `themes` (docs/themes.md).
 *
 * This file is plain TypeScript with no React Native imports, so it can be tested.
 */

/** Colours are "H S% L%" triplets, the form Tailwind's `hsl(var(--token))` needs. */
export const colorTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "tone-rose",
  "tone-rose-foreground",
  "tone-sage",
  "tone-sage-foreground",
  "tone-peach",
  "tone-peach-foreground",
  "tone-lavender",
  "tone-lavender-foreground",
  "tone-butter",
  "tone-butter-foreground",
  "tone-sky",
  "tone-sky-foreground",
] as const

export type ColorToken = (typeof colorTokens)[number]
export type ColorTokens = Record<ColorToken, string>

/** Everything except colours that can change between themes. */
export type ShapeTokens = {
  /** Corner radius of cards, in rem. Buttons and inputs derive from it. */
  radius: string
  /** Colour of the soft shadow under cards ("transparent" for none). */
  shadow: string
  /**
   * Corner radii of cards in px (top left, top right, bottom right, bottom left).
   * Slightly different corners give the organic, hand-cut look. null = all `radius`.
   */
  cardRadii: [number, number, number, number] | null
}

export type IconStyle = "cozy" | "classic"

export type ThemeDefinition = {
  id: string
  /** Translation key (namespace "settings") of the theme's name. */
  nameKey: string
  /** Font family of headings. Must be loaded in `lib/fonts.ts`; null = system font. */
  headingFont: string | null
  icons: IconStyle
  shape: ShapeTokens
  light: ColorTokens
  dark: ColorTokens
}

const cozyLight: ColorTokens = {
  background: "40 60% 96%",
  foreground: "20 25% 16%",
  card: "40 75% 99%",
  "card-foreground": "20 25% 16%",
  primary: "14 58% 38%",
  "primary-foreground": "40 70% 97%",
  secondary: "35 45% 90%",
  "secondary-foreground": "20 25% 16%",
  muted: "35 35% 92%",
  "muted-foreground": "25 15% 33%",
  accent: "35 50% 88%",
  "accent-foreground": "20 25% 16%",
  destructive: "4 65% 40%",
  border: "30 30% 83%",
  input: "28 22% 52%",
  ring: "14 58% 50%",
  "tone-rose": "350 70% 90%",
  "tone-rose-foreground": "345 50% 24%",
  "tone-sage": "135 28% 85%",
  "tone-sage-foreground": "140 35% 18%",
  "tone-peach": "25 90% 87%",
  "tone-peach-foreground": "20 60% 21%",
  "tone-lavender": "265 55% 91%",
  "tone-lavender-foreground": "265 35% 25%",
  "tone-butter": "45 90% 86%",
  "tone-butter-foreground": "35 70% 20%",
  "tone-sky": "205 65% 88%",
  "tone-sky-foreground": "210 50% 20%",
}

const cozyDark: ColorTokens = {
  background: "20 18% 10%",
  foreground: "38 40% 92%",
  card: "20 16% 15%",
  "card-foreground": "38 40% 92%",
  primary: "14 65% 64%",
  "primary-foreground": "20 30% 10%",
  secondary: "20 14% 20%",
  "secondary-foreground": "38 40% 92%",
  muted: "20 12% 18%",
  "muted-foreground": "35 15% 70%",
  accent: "20 14% 22%",
  "accent-foreground": "38 40% 92%",
  destructive: "4 80% 68%",
  border: "20 12% 24%",
  input: "20 10% 42%",
  ring: "14 65% 60%",
  "tone-rose": "345 30% 24%",
  "tone-rose-foreground": "350 60% 89%",
  "tone-sage": "140 18% 22%",
  "tone-sage-foreground": "135 30% 86%",
  "tone-peach": "22 35% 24%",
  "tone-peach-foreground": "25 70% 88%",
  "tone-lavender": "265 22% 26%",
  "tone-lavender-foreground": "265 55% 90%",
  "tone-butter": "42 40% 22%",
  "tone-butter-foreground": "45 80% 86%",
  "tone-sky": "205 30% 22%",
  "tone-sky-foreground": "205 65% 88%",
}

const classicLight: ColorTokens = {
  background: "0 0% 100%",
  foreground: "0 0% 3.9%",
  card: "0 0% 100%",
  "card-foreground": "0 0% 3.9%",
  primary: "226 70% 40%",
  "primary-foreground": "214 100% 97%",
  secondary: "240 5% 96%",
  "secondary-foreground": "240 6% 10%",
  muted: "0 0% 96.1%",
  "muted-foreground": "0 0% 40%",
  accent: "0 0% 96.1%",
  "accent-foreground": "0 0% 9%",
  destructive: "0 72% 45%",
  border: "0 0% 89.8%",
  input: "0 0% 55%",
  ring: "0 0% 63%",
  "tone-rose": "350 80% 92%",
  "tone-rose-foreground": "345 60% 24%",
  "tone-sage": "140 40% 90%",
  "tone-sage-foreground": "140 50% 18%",
  "tone-peach": "25 95% 90%",
  "tone-peach-foreground": "20 70% 22%",
  "tone-lavender": "265 80% 94%",
  "tone-lavender-foreground": "265 50% 26%",
  "tone-butter": "48 95% 88%",
  "tone-butter-foreground": "35 80% 20%",
  "tone-sky": "205 90% 91%",
  "tone-sky-foreground": "210 70% 22%",
}

const classicDark: ColorTokens = {
  background: "0 0% 3.9%",
  foreground: "0 0% 98%",
  card: "0 0% 7%",
  "card-foreground": "0 0% 98%",
  primary: "226 70% 62%",
  "primary-foreground": "226 40% 8%",
  secondary: "240 4% 16%",
  "secondary-foreground": "0 0% 98%",
  muted: "0 0% 14.9%",
  "muted-foreground": "0 0% 66%",
  accent: "0 0% 14.9%",
  "accent-foreground": "0 0% 98%",
  destructive: "0 80% 68%",
  border: "0 0% 14.9%",
  input: "0 0% 40%",
  ring: "0 0% 45%",
  "tone-rose": "345 35% 20%",
  "tone-rose-foreground": "350 70% 90%",
  "tone-sage": "140 25% 18%",
  "tone-sage-foreground": "140 40% 88%",
  "tone-peach": "22 40% 20%",
  "tone-peach-foreground": "25 80% 90%",
  "tone-lavender": "265 25% 22%",
  "tone-lavender-foreground": "265 70% 92%",
  "tone-butter": "42 45% 19%",
  "tone-butter-foreground": "48 90% 88%",
  "tone-sky": "205 35% 19%",
  "tone-sky-foreground": "205 80% 90%",
}

export const cozy: ThemeDefinition = {
  id: "cozy",
  nameKey: "theme.cozy",
  headingFont: "PatrickHand_400Regular",
  icons: "cozy",
  shape: {
    radius: "1.25rem",
    shadow: "rgba(120, 80, 50, 0.14)",
    cardRadii: [26, 18, 24, 20],
  },
  light: cozyLight,
  dark: cozyDark,
}

export const classic: ThemeDefinition = {
  id: "classic",
  nameKey: "theme.classic",
  headingFont: null,
  icons: "classic",
  shape: { radius: "0.625rem", shadow: "transparent", cardRadii: null },
  light: classicLight,
  dark: classicDark,
}

/** All themes, in the order of the dropdown. Add new themes here. */
export const themes: ThemeDefinition[] = [cozy, classic]

export const DEFAULT_THEME_ID = cozy.id

export function isThemeId(value: unknown): value is string {
  return typeof value === "string" && themes.some((theme) => theme.id === value)
}

/** The theme with this id, or the default when it is unknown (for example after removal). */
export function getTheme(id: string | null | undefined): ThemeDefinition {
  return themes.find((theme) => theme.id === id) ?? cozy
}

/** The CSS variables (`--background`, `--radius`, ...) that make up one variant of a theme. */
export function themeVariables(
  theme: ThemeDefinition,
  scheme: "light" | "dark"
): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const token of colorTokens)
    variables[`--${token}`] = theme[scheme][token]
  variables["--radius"] = theme.shape.radius
  return variables
}

// Contrast helpers, used by the tests and available for future checks.

function parseHsl(value: string): [number, number, number] {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part))
  return [h!, s! / 100, l! / 100]
}

function relativeLuminance(value: string) {
  const [h, s, l] = parseHsl(value)
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4)
}

/** WCAG contrast ratio between two "H S% L%" colours (1 to 21). */
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  )
  return (light! + 0.05) / (dark! + 0.05)
}
