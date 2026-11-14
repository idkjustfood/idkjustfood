import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..")
const localesDir = join(root, "locales")
const languages = readdirSync(localesDir).filter((name) =>
  statSync(join(localesDir, name)).isDirectory()
)

type Json = { [key: string]: string | Json }

const read = (language: string, file: string) =>
  JSON.parse(readFileSync(join(localesDir, language, file), "utf8")) as Json

/** "a.b.c" for every text in a nested translation file. */
function flatten(value: Json, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof item === "string") out[path] = item
    else Object.assign(out, flatten(item, path))
  }
  return out
}

/** Plural keys differ per language ("_one", "_few", ...), so compare the base key. */
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "")

const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort()

describe("translation files", () => {
  test("English exists and is the reference", () => {
    expect(languages).toContain("en")
  })

  const english = readdirSync(join(localesDir, "en"))

  for (const language of languages.filter((name) => name !== "en")) {
    describe(language, () => {
      test("has every file English has", () => {
        expect(readdirSync(join(localesDir, language)).sort()).toEqual(
          [...english].sort()
        )
      })

      for (const file of english) {
        test(`${file}: same keys, filled in, same placeholders`, () => {
          const reference = flatten(read("en", file))
          const translated = flatten(read(language, file))
          const referenceKeys = new Set(Object.keys(reference).map(base))
          const translatedKeys = new Set(Object.keys(translated).map(base))
          expect(
            [...referenceKeys].filter((k) => !translatedKeys.has(k))
          ).toEqual([])
          expect(
            [...translatedKeys].filter((k) => !referenceKeys.has(k))
          ).toEqual([])
          for (const [key, text] of Object.entries(translated)) {
            expect(text.trim() === "" ? key : "").toBe("")
            const source = reference[key] ?? reference[`${base(key)}_other`]
            if (source !== undefined && !/_(zero|one|two)$/.test(key))
              expect([key, placeholders(text)]).toEqual([
                key,
                placeholders(source),
              ])
          }
        })
      }
    })
  }
})

/** All .tsx files in the app, without dependencies. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", "locales", "dist", ".expo"].includes(name)) return []
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return path.endsWith(".tsx") ? [path] : []
  })
}

// Props that show text to the person (or a screen reader).
const textProps =
  "title|label|placeholder|description|subtitle|accessibilityLabel|aria-label|alt|hint|message|emptyText"

describe("no hardcoded text", () => {
  for (const file of sources(root)) {
    test(file.slice(root.length + 1), () => {
      // Comments may say anything, so they are left out.
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
      const found: string[] = []
      // <Text>Some words</Text>: letters between tags, outside of {...}.
      for (const m of code.matchAll(/>\s*(\p{L}[^<>{}=;()?&|]*)</gu)) {
        const text = m[1]!.trim()
        // Code that looks like text (`return`, `Promise<...>`) and the brand name.
        if (/^[a-z]+$/.test(text) || /^(Promise|Array|Record)$/.test(text))
          continue
        if (text === "idkjustfood") continue
        if (/\p{L}{2,}/u.test(text)) found.push(text)
      }
      // title="Some words" and similar props with a plain string.
      for (const m of code.matchAll(
        new RegExp(String.raw`\b(?:${textProps})="([^"]*\p{L}{2,}[^"]*)"`, "gu")
      ))
        if (!m[1]!.includes("://")) found.push(m[1]!)
      expect(found).toEqual([])
    })
  }
})
