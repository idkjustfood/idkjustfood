import { describe, expect, test } from "bun:test"

import { completeRecipe } from "./complete.js"
import { fakeAi } from "./testing.js"

const sauce = {
  title: "Pizza sauce",
  servings: 4,
  ingredients: [{ name: "Tomatoes", quantity: 400, unit: "g" as const, note: null }],
  steps: [{ text: "Simmer." }],
}

const dough = {
  ingredients: [
    { name: "Flour", quantity: 500, unit: "g", note: null, section: "Dough" },
    { name: "Yeast", quantity: null, unit: "packet", note: null, section: "Dough" },
  ],
  steps: [{ text: "Knead.", section: "Dough" }],
}

describe("completeRecipe", () => {
  test("adds the dough and keeps the sauce as it was", async () => {
    const ai = fakeAi({ parseRecipe: async () => dough })
    const result = await completeRecipe(ai, sauce, "add a pizza dough", "de")
    expect(result.ingredients[0]).toEqual(sauce.ingredients[0]!)
    expect(result.steps[0]).toEqual(sauce.steps[0]!)
    expect(result.ingredients.map((i) => i.name)).toEqual(["Tomatoes", "Flour", "Yeast"])
    expect(result.addedIngredients).toEqual([1, 2])
    expect(result.addedSteps).toEqual([1])
    // an unknown unit is fitted, an unsure amount stays empty
    expect(result.ingredients[2]?.quantity).toBeNull()
  })

  test("tells the AI the recipe, the message and the language", async () => {
    let seen: { material: string; language?: string; instruction?: string } | undefined
    const ai = fakeAi({
      parseRecipe: async (material, options) => {
        seen = { material, language: options?.language, instruction: options?.instruction }
        return dough
      },
    })
    await completeRecipe(ai, sauce, "add a pizza dough", "de")
    expect(seen?.language).toBe("de")
    expect(seen?.material).toContain("add a pizza dough")
    expect(seen?.material).toContain("Tomatoes")
    expect(seen?.instruction).toContain("ONLY the new parts")
    expect(seen?.instruction).toContain("German")
  })

  test("fails when there is nothing to add", async () => {
    const ai = fakeAi({ parseRecipe: async () => ({ ingredients: [], steps: [] }) })
    await expect(completeRecipe(ai, sauce, "hello")).rejects.toMatchObject({
      code: "nothing_to_add",
    })
  })

  test("fails when everything the AI wrote is already there", async () => {
    const ai = fakeAi({
      parseRecipe: async () => ({
        ingredients: [{ name: "tomatoes", quantity: 1, unit: null, note: null }],
        steps: [],
      }),
    })
    await expect(completeRecipe(ai, sauce, "more tomatoes")).rejects.toMatchObject({
      code: "nothing_to_add",
    })
  })

  test("fails with a clear error when the answer is not usable", async () => {
    const ai = fakeAi({ parseRecipe: async () => ({ ingredients: "no" }) })
    await expect(completeRecipe(ai, sauce, "x")).rejects.toMatchObject({
      code: "invalid_recipe",
    })
  })
})
