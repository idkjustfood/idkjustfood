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
          { key: "a", quantity: "", unit: "", name: "Salt", note: "", sectionKey: "" },
          { key: "b", quantity: " 1 1/2 ", unit: "cup", name: "Flour", note: "sifted", sectionKey: "" },
          { key: "c", quantity: "", unit: "", name: "", note: "", sectionKey: "" },
        ],
        steps: [
          { key: "s1", text: "  Boil.  ", sectionKey: "" },
          { key: "s2", text: "   ", sectionKey: "" },
        ],
        calories: "350",
        fat: "12,5",
        tags: ["vegan", "soup", "italian"],
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
    // In the fixed order of the list, not the order they were picked in.
    expect(result.content.tags).toEqual(["italian", "soup", "vegan"])
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
          { key: "a", quantity: "lots", unit: "", name: "Salt", note: "", sectionKey: "" },
          { key: "b", quantity: "2", unit: "g", name: "", note: "", sectionKey: "" },
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
      tags: ["indian"],
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

describe("sections in a draft", () => {
  test("a recipe without sections stays without sections", () => {
    const result = readDraft(
      filled({
        ingredients: [
          { key: "a", quantity: "1", unit: "", name: "Egg", note: "", sectionKey: "" },
        ],
        steps: [{ key: "s", text: "Boil.", sectionKey: "" }],
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content.ingredients).toEqual([
      { name: "Egg", quantity: 1, unit: null, note: null },
    ])
    expect(result.content.steps).toEqual([{ text: "Boil." }])
  })

  test("rows are put under their section, in the order of the sections", () => {
    const row = (key: string, name: string, sectionKey: string) => ({
      key,
      quantity: "",
      unit: "",
      name,
      note: "",
      sectionKey,
    })
    const result = readDraft(
      filled({
        sections: [
          { key: "sauce", name: " Sauce " },
          { key: "dough", name: "Dough" },
          { key: "empty", name: "Unused" },
        ],
        ingredients: [
          row("1", "Tomato", "sauce"),
          row("2", "Flour", "dough"),
          row("3", "Salt", ""),
        ],
        steps: [
          { key: "a", text: "Dough.", sectionKey: "dough" },
          { key: "b", text: "Sauce.", sectionKey: "sauce" },
          { key: "c", text: "Bake.", sectionKey: "" },
        ],
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content.ingredients.map((i) => [i.name, i.section])).toEqual([
      ["Salt", null],
      ["Tomato", "Sauce"],
      ["Flour", "Dough"],
    ])
    expect(result.content.steps.map((s) => [s.text, s.section])).toEqual([
      ["Bake.", null],
      ["Sauce.", "Sauce"],
      ["Dough.", "Dough"],
    ])
  })

  test("a section with rows needs a name", () => {
    const result = readDraft(
      filled({
        sections: [{ key: "x", name: " " }],
        steps: [{ key: "a", text: "Stir.", sectionKey: "x" }],
      })
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors["section.x.name"]).toBeDefined()
  })

  test("a recipe with sections becomes a draft and back without change", () => {
    const content: DraftContent = {
      ...(readDraft(filled()) as { ok: true; content: DraftContent }).content,
      ingredients: [
        { name: "Tomato", quantity: 2, unit: null, note: null, section: "Sauce" },
        { name: "Flour", quantity: 200, unit: "g", note: null, section: "Dough" },
      ],
      steps: [
        { text: "Cook.", section: "Sauce" },
        { text: "Knead.", section: "Dough" },
      ],
    }
    const draft = draftFromRecipe(content, key)
    expect(draft.sections.map((s) => s.name)).toEqual(["Sauce", "Dough"])
    const back = readDraft(draft)
    expect(back.ok && back.content).toEqual(content)
  })
})

