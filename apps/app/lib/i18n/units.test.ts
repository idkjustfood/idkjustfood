import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { unitKeys } from "@workspace/schemas"

const localesDir = join(import.meta.dir, "..", "..", "locales")
const languages = readdirSync(localesDir).filter((name) =>
  statSync(join(localesDir, name)).isDirectory()
)

describe("unit names", () => {
  for (const language of languages) {
    test(`${language} names every unit in the list`, () => {
      const common = JSON.parse(
        readFileSync(join(localesDir, language, "common.json"), "utf8")
      ) as { units: Record<string, string>; unitPicker: { none: string } }
      const missing = unitKeys.filter(
        (unit) =>
          !(unit in common.units) &&
          !(`${unit}_one` in common.units && `${unit}_other` in common.units)
      )
      expect(missing).toEqual([])
      expect(common.unitPicker.none.trim()).not.toBe("")
    })
  }

  test("German uses EL, Stück and Prise, English tbsp, piece and pinch", () => {
    const units = (language: string) =>
      (
        JSON.parse(
          readFileSync(join(localesDir, language, "common.json"), "utf8")
        ) as { units: Record<string, string> }
      ).units
    expect(units("de").tbsp).toBe("EL")
    expect(units("de").piece).toBe("Stück")
    expect(units("de").pinch_one).toBe("Prise")
    expect(units("en").tbsp).toBe("tbsp")
    expect(units("en").piece_one).toBe("piece")
    expect(units("en").pinch_one).toBe("pinch")
  })
})
