import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  colorTokens,
  contrastRatio,
  getTheme,
  themeVariables,
  themes,
} from "@/lib/themes"

const readable: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["tone-rose-foreground", "tone-rose"],
  ["tone-sage-foreground", "tone-sage"],
  ["tone-peach-foreground", "tone-peach"],
  ["tone-lavender-foreground", "tone-lavender"],
  ["tone-butter-foreground", "tone-butter"],
  ["tone-sky-foreground", "tone-sky"],
]

describe("themes", () => {
  test("ids are unique and the default is cozy", () => {
    const ids = themes.map((theme) => theme.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(getTheme(undefined).id).toBe("cozy")
    expect(getTheme("does-not-exist").id).toBe("cozy")
  })

  for (const theme of themes) {
    for (const scheme of ["light", "dark"] as const) {
      describe(`${theme.id} ${scheme}`, () => {
        test("defines every token as an HSL triplet", () => {
          for (const token of colorTokens) {
            expect(theme[scheme][token]).toMatch(
              /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/
            )
          }
          expect(Object.keys(themeVariables(theme, scheme))).toContain(
            "--radius"
          )
        })

        test("text is easy to read (contrast 4.5 or more)", () => {
          for (const [front, back] of readable) {
            const ratio = contrastRatio(
              theme[scheme][front as keyof typeof theme.light],
              theme[scheme][back as keyof typeof theme.light]
            )
            expect(`${front} on ${back}: ${ratio >= 4.5}`).toBe(
              `${front} on ${back}: true`
            )
          }
        })

        test("input borders are visible (contrast 3 or more)", () => {
          expect(
            contrastRatio(theme[scheme].input, theme[scheme].background)
          ).toBeGreaterThanOrEqual(3)
        })
      })
    }
  }
})

describe("no hardcoded colours", () => {
  const root = join(import.meta.dir, "..")
  const files = ["app", "components"].flatMap((dir) =>
    (readdirSync(join(root, dir), { recursive: true }) as string[])
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => join(root, dir, name))
  )
  // Palette colours (bg-amber-100), black/white, hex and rgb()/hsl() values.
  const palette =
    /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b|#[0-9a-fA-F]{6}\b|\b(?:rgb|hsl)a?\(/

  test("screens and components use theme tokens only", () => {
    const offenders = files.filter((file) =>
      palette.test(readFileSync(file, "utf8"))
    )
    expect(offenders.map((file) => file.replace(root, ""))).toEqual([])
  })
})
