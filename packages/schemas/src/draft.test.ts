import { describe, expect, test } from "bun:test"

import {
  draftFromRecipe,
  emptyDraft,
  readDraft,
  RecipeContentSchema,
  type DraftContent,
  type RecipeDraft,
} from "./index.js"

let counter = 0
const key = () => `k${++counter}`

function filled(patch: Partial<RecipeDraft> = {}): RecipeDraft {
  return { ...emptyDraft(key), title: "Soup", ...patch }
}

describe("readDraft", () => {
  test("an empty form is only missing a title", () => {
    const result = readDraft(emptyDraft(key))
    expect(result).toEqual({
      ok: false,
      errors: { title: "Give the recipe a title." },
    })
  })

  test("empty amounts and empty values stay empty", () => {
    const result = readDraft(
      filled({
        ingredients: [
          { key: "a", quantity: "", unit: "", name: "Salt", note: "" },
          { key: "b", quantity: " 1 1/2 ", unit: "cup", name: "Flour", note: "sifted" },
          { key: "c", quantity: "", unit: "", name: "", note: "" },
        ],
        steps: [
          { key: "s1", text: "  Boil.  " },
          { key: "s2", text: "   " },
        ],
        calories: "350",
        fat: "12,5",
        tags: "Soup, soup , Vegan,,",
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content.ingredients).toEqual([
      { name: "Salt", quantity: null, unit: null, note: null },
      { name: "Flour", quantity: 1.5, unit: "cup", note: "sifted" },
    ])
    expect(result.content.steps).toEqual([{ text: "Boil." }])
    expect(result.content.nutrition).toEqual({
      calories: 350,
      protein: null,
      carbs: null,
      fat: 12.5,
    })
    expect(result.content.tags).toEqual(["Soup", "Vegan"])
    expect(result.content.prepMinutes).toBeNull()
    // What we produce is a valid recipe.
    expect(
      RecipeContentSchema.safeParse({
        ...result.content,
        source: { kind: "manual", label: null, url: null },
      }).success
    ).toBe(true)
  })

  test("says which field is wrong", () => {
    const result = readDraft(
      filled({
        servings: "0",
        prepMinutes: "ten",
        protein: "-3",
        ingredients: [
          { key: "a", quantity: "lots", unit: "", name: "Salt", note: "" },
          { key: "b", quantity: "2", unit: "g", name: "", note: "" },
        ],
      })
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual([
      "ingredient.a.quantity",
      "ingredient.b.name",
      "prepMinutes",
      "protein",
      "servings",
    ])
  })

  test("a saved recipe becomes the same draft content again", () => {
    const recipe: DraftContent = {
      title: "Dal",
      description: "",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: null,
      tags: ["Indian"],
      ingredients: [
        { name: "Lentils", quantity: 250, unit: "g", note: null },
        { name: "Salt", quantity: null, unit: null, note: null },
      ],
      steps: [{ text: "Simmer." }],
      nutrition: { calories: null, protein: 12, carbs: null, fat: null },
    }
    const result = readDraft(draftFromRecipe(recipe, key))
    expect(result).toEqual({ ok: true, content: recipe })
  })
})
