import { describe, expect, test } from "bun:test"

import { IngredientSchema } from "./recipe.js"
import { readDraft, emptyDraft } from "./draft.js"
import { fitIngredientUnits } from "./recipe.js"
import {
  fitUnit,
  isUnitKey,
  normalizeUnit,
  unitKeys,
  unitsForSystem,
  unitSpellings,
} from "./units.js"
import { ShoppingItemInputSchema } from "./shopping.js"

describe("the list of units", () => {
  test("holds the units from the ticket", () => {
    expect([...unitKeys]).toEqual([
      "g", "kg", "mg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "fl_oz",
      "piece", "pinch", "clove", "bunch", "slice", "can", "pack",
    ])
  })

  test("every spelling maps to a unit in the list", () => {
    for (const [spelling, key] of unitSpellings) {
      expect(isUnitKey(key)).toBe(true)
      expect(normalizeUnit(spelling)).toBe(key)
    }
  })

  test("no spelling belongs to two units", () => {
    const seen = new Map<string, string>()
    for (const [spelling, key] of unitSpellings) {
      expect(seen.get(spelling) ?? key).toBe(key)
      seen.set(spelling, key)
    }
  })
})

describe("normalizeUnit", () => {
  test("reads spellings in all app languages", () => {
    expect(normalizeUnit("grams")).toBe("g")
    expect(normalizeUnit("Gramm")).toBe("g")
    expect(normalizeUnit("EL")).toBe("tbsp")
    expect(normalizeUnit("Esslöffel")).toBe("tbsp")
    expect(normalizeUnit("TL")).toBe("tsp")
    expect(normalizeUnit("Stück")).toBe("piece")
    expect(normalizeUnit("Prise")).toBe("pinch")
    expect(normalizeUnit("Zehe")).toBe("clove")
    expect(normalizeUnit("cucharadas")).toBe("tbsp")
    expect(normalizeUnit("cuillère à soupe")).toBe("tbsp")
    expect(normalizeUnit("spicchi")).toBe("clove")
    expect(normalizeUnit(" Tbsp. ")).toBe("tbsp")
    expect(normalizeUnit("fl. oz")).toBe("fl_oz")
  })

  test("returns null for anything else", () => {
    expect(normalizeUnit("handful")).toBeNull()
    expect(normalizeUnit("")).toBeNull()
    expect(normalizeUnit(null)).toBeNull()
  })
})

describe("fitUnit", () => {
  test("keeps a unit that fits", () => {
    expect(fitUnit("grams", null)).toEqual({ unit: "g", note: null })
  })

  test("moves a unit that does not fit into the note", () => {
    expect(fitUnit("handful", null)).toEqual({ unit: null, note: "handful" })
    expect(fitUnit("handful", "washed")).toEqual({
      unit: null,
      note: "handful, washed",
    })
  })

  test("no unit stays no unit", () => {
    expect(fitUnit(null, "chopped")).toEqual({ unit: null, note: "chopped" })
    expect(fitUnit("  ", null)).toEqual({ unit: null, note: null })
  })

  test("fits the units of a list of ingredients", () => {
    expect(
      fitIngredientUnits([
        { name: "flour", quantity: 2, unit: "Esslöffel", note: null },
        { name: "basil", quantity: 1, unit: "handful", note: null },
      ])
    ).toEqual([
      { name: "flour", quantity: 2, unit: "tbsp", note: null },
      { name: "basil", quantity: 1, unit: null, note: "handful" },
    ])
    expect(fitIngredientUnits("nope")).toBe("nope")
  })
})

describe("validation", () => {
  const flour = { name: "Flour", quantity: 200, unit: "g", note: null }

  test("an ingredient only takes a unit from the list", () => {
    expect(IngredientSchema.safeParse(flour).success).toBe(true)
    expect(IngredientSchema.safeParse({ ...flour, unit: null }).success).toBe(true)
    expect(IngredientSchema.safeParse({ ...flour, unit: "grams" }).success).toBe(false)
    expect(IngredientSchema.safeParse({ ...flour, unit: "" }).success).toBe(false)
  })

  test("a shopping item only takes a unit from the list", () => {
    expect(ShoppingItemInputSchema.safeParse({ name: "Milk", unit: "l" }).success).toBe(true)
    expect(ShoppingItemInputSchema.safeParse({ name: "Milk", unit: "litres" }).success).toBe(false)
  })

  test("the recipe form reports a unit that is not in the list", () => {
    const draft = emptyDraft(() => "row")
    draft.title = "Soup"
    draft.ingredients = [
      { key: "a", quantity: "2", unit: "grams", name: "Salt", note: "", sectionKey: "" },
    ]
    expect(readDraft(draft)).toMatchObject({
      ok: false,
      errors: { "ingredient.a.unit": expect.any(String) },
    })
  })
})

describe("unitsForSystem", () => {
  test("metric shows g but not oz, imperial the other way round", () => {
    const metric = unitsForSystem("metric")
    const imperial = unitsForSystem("imperial")
    expect(metric).toContain("g")
    expect(metric).not.toContain("oz")
    expect(imperial).toContain("oz")
    expect(imperial).not.toContain("g")
  })

  test("generic units are in both", () => {
    for (const system of ["metric", "imperial"] as const) {
      for (const unit of ["cup", "tsp", "tbsp", "piece", "pinch", "clove"] as const) {
        expect(unitsForSystem(system)).toContain(unit)
      }
    }
  })
})
