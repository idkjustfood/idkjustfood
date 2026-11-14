import { describe, expect, test } from "bun:test"

import { mergeCompletion } from "./complete.js"

const sauce = {
  ingredients: [
    { name: "Tomatoes", quantity: 400, unit: "g" as const, note: null },
    { name: "Salt", quantity: null, unit: null, note: null },
  ],
  steps: [{ text: "Simmer the tomatoes." }],
}

describe("mergeCompletion", () => {
  test("adds the new parts and leaves the existing ones exactly as they were", () => {
    const result = mergeCompletion(sauce, {
      ingredients: [
        { name: "Flour", quantity: 500, unit: "g", note: null, section: "Dough" },
        { name: "Yeast", quantity: null, unit: null, note: null, section: "Dough" },
      ],
      steps: [{ text: "Knead the dough.", section: "Dough" }],
    })
    expect(result.ingredients.slice(0, 2)).toEqual(sauce.ingredients)
    expect(result.steps[0]).toEqual(sauce.steps[0])
    expect(result.ingredients.map((i) => i.name)).toEqual([
      "Tomatoes",
      "Salt",
      "Flour",
      "Yeast",
    ])
    expect(result.addedIngredients).toEqual([2, 3])
    expect(result.addedSteps).toEqual([1])
  })

  test("leaves an amount empty when the AI gave none", () => {
    const result = mergeCompletion(sauce, {
      ingredients: [{ name: "Yeast", quantity: null, unit: null, note: null }],
      steps: [],
    })
    expect(result.ingredients[2]?.quantity).toBeNull()
  })

  test("drops an ingredient that is already in the same part", () => {
    const result = mergeCompletion(sauce, {
      ingredients: [
        { name: " tomatoes ", quantity: 1, unit: null, note: null },
        { name: "Basil", quantity: null, unit: null, note: null },
        { name: "basil", quantity: 2, unit: null, note: null },
      ],
      steps: [],
    })
    expect(result.ingredients.map((i) => i.name)).toEqual([
      "Tomatoes",
      "Salt",
      "Basil",
    ])
    expect(result.addedIngredients).toEqual([2])
  })

  test("keeps the same name in another part", () => {
    const result = mergeCompletion(sauce, {
      ingredients: [
        { name: "Salt", quantity: 1, unit: "tsp", note: null, section: "Dough" },
      ],
      steps: [],
    })
    expect(result.ingredients).toHaveLength(3)
  })

  test("a new part with the name of an existing one (any case) joins it", () => {
    const existing = {
      ingredients: [
        { name: "Flour", quantity: 1, unit: "cup" as const, note: null, section: "Dough" },
        { name: "Tomatoes", quantity: 1, unit: null, note: null, section: "Sauce" },
      ],
      steps: [],
    }
    const result = mergeCompletion(existing, {
      ingredients: [{ name: "Water", quantity: null, unit: null, note: null, section: "dough" }],
      steps: [],
    })
    expect(result.ingredients.map((i) => [i.name, i.section])).toEqual([
      ["Flour", "Dough"],
      ["Water", "Dough"],
      ["Tomatoes", "Sauce"],
    ])
    expect(result.addedIngredients).toEqual([1])
  })

  test("nothing to add changes nothing", () => {
    const result = mergeCompletion(sauce, { ingredients: [], steps: [] })
    expect(result.ingredients).toEqual(sauce.ingredients)
    expect(result.addedIngredients).toEqual([])
    expect(result.addedSteps).toEqual([])
  })
})
