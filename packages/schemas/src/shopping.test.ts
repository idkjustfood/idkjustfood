import { describe, expect, test } from "bun:test"

import { addIngredients, type ShoppingItemContent } from "./shopping.js"

const item = (
  name: string,
  quantity: number | null,
  unit: string | null,
  extra: Partial<ShoppingItemContent> = {}
): ShoppingItemContent => ({
  name,
  quantity,
  unit,
  note: null,
  checked: false,
  fromRecipes: [],
  ...extra,
})

const ingredient = (
  name: string,
  quantity: number | null,
  unit: string | null
) => ({
  name,
  quantity,
  unit,
  note: null,
})

describe("addIngredients", () => {
  test("adds ingredients to an empty list", () => {
    const result = addIngredients(
      [],
      [ingredient("Flour", 200, "g")],
      "Pancakes"
    )
    expect(result).toEqual([
      item("Flour", 200, "g", { fromRecipes: ["Pancakes"] }),
    ])
  })

  test("sums the same ingredient with the same unit", () => {
    const first = addIngredients(
      [],
      [ingredient("Flour", 200, "g")],
      "Pancakes"
    )
    const second = addIngredients(
      first,
      [ingredient("Flour", 100, "g")],
      "Bread"
    )
    expect(second).toEqual([
      item("Flour", 300, "g", { fromRecipes: ["Pancakes", "Bread"] }),
    ])
  })

  test("matches names and unit spellings loosely", () => {
    const first = addIngredients([], [ingredient("flour", 200, "grams")], "A")
    const second = addIngredients(first, [ingredient(" Flour ", 100, "g")], "B")
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({
      name: "flour",
      quantity: 300,
      unit: "grams",
    })
  })

  test("keeps different units apart (no conversion)", () => {
    const first = addIngredients([], [ingredient("Flour", 200, "g")], "A")
    const second = addIngredients(first, [ingredient("Flour", 1, "cup")], "B")
    expect(second.map((i) => [i.quantity, i.unit])).toEqual([
      [200, "g"],
      [1, "cup"],
    ])
  })

  test("never invents an amount", () => {
    const result = addIngredients([], [ingredient("Salt", null, null)], "A")
    expect(result[0]).toMatchObject({
      name: "Salt",
      quantity: null,
      unit: null,
    })
  })

  test("an ingredient without an amount does not change an amount", () => {
    const first = addIngredients([], [ingredient("Salt", 5, "g")], "A")
    const second = addIngredients(first, [ingredient("Salt", null, null)], "B")
    expect(second).toHaveLength(2)
    expect(second[0]!.quantity).toBe(5)
    expect(second[1]!.quantity).toBeNull()
  })

  test("two ingredients without an amount become one line", () => {
    const first = addIngredients([], [ingredient("Salt", null, null)], "A")
    const second = addIngredients(first, [ingredient("Salt", null, null)], "B")
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({ quantity: null, fromRecipes: ["A", "B"] })
  })

  test("sums within one recipe too", () => {
    const result = addIngredients(
      [],
      [ingredient("Onion", 1, null), ingredient("Onion", 2, null)],
      "A"
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.quantity).toBe(3)
  })

  test("scales by the factor", () => {
    const result = addIngredients([], [ingredient("Flour", 200, "g")], "A", 1.5)
    expect(result[0]!.quantity).toBe(300)
  })

  test("does not merge into an item that is already ticked off", () => {
    const first = [item("Flour", 200, "g", { checked: true })]
    const second = addIngredients(first, [ingredient("Flour", 100, "g")], "B")
    expect(second).toHaveLength(2)
    expect(second[0]!.quantity).toBe(200)
    expect(second[1]).toMatchObject({ quantity: 100, checked: false })
  })

  test("does not repeat a recipe title and does not change the input", () => {
    const first = addIngredients([], [ingredient("Flour", 200, "g")], "A")
    const copy = structuredClone(first)
    const second = addIngredients(first, [ingredient("Flour", 100, "g")], "A")
    expect(second[0]!.fromRecipes).toEqual(["A"])
    expect(first).toEqual(copy)
  })

  test("avoids floating point noise", () => {
    const first = addIngredients([], [ingredient("Milk", 0.1, "l")], "A")
    const second = addIngredients(first, [ingredient("Milk", 0.2, "l")], "B")
    expect(second[0]!.quantity).toBe(0.3)
  })
})
