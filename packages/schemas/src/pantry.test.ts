import { describe, expect, test } from "bun:test"

import { recipeLanguages } from "./language.js"
import {
  defaultPantry,
  defaultPantryItems,
  pantryKey,
  splitStaples,
} from "./pantry.js"
import type { Ingredient } from "./recipe.js"

const ingredient = (name: string): Ingredient => ({
  name,
  quantity: null,
  unit: null,
  note: null,
})

describe("pantryKey", () => {
  test("ignores case and extra spaces", () => {
    expect(pantryKey("  Olive   OIL ")).toBe("olive oil")
    expect(pantryKey("Öl")).toBe(pantryKey("öl"))
  })
})

describe("splitStaples", () => {
  const staples = ["salt", "Olive oil"]

  test("leaves out ingredients on the list, ignoring case and spaces", () => {
    const { needed, skipped } = splitStaples(
      [ingredient("Salt"), ingredient(" olive  oil "), ingredient("Flour")],
      staples
    )
    expect(skipped.map((i) => i.name)).toEqual(["Salt", " olive  oil "])
    expect(needed.map((i) => i.name)).toEqual(["Flour"])
  })

  test("does not match similar names", () => {
    const { needed, skipped } = splitStaples([ingredient("Sea salt")], staples)
    expect(skipped).toEqual([])
    expect(needed).toHaveLength(1)
  })

  test("keeps everything when the list is empty", () => {
    const { needed, skipped } = splitStaples([ingredient("Salt")], [])
    expect(needed).toHaveLength(1)
    expect(skipped).toEqual([])
  })
})

describe("default list", () => {
  test("exists for every language and has no duplicates", () => {
    for (const language of recipeLanguages) {
      const items = defaultPantryItems[language]
      expect(items.length).toBeGreaterThan(0)
      expect(new Set(items.map(pantryKey)).size).toBe(items.length)
    }
  })

  test("falls back to English and returns a copy", () => {
    expect(defaultPantry()).toEqual([...defaultPantryItems.en])
    defaultPantry().push("x")
    expect(defaultPantry()).toHaveLength(defaultPantryItems.en.length)
  })
})
