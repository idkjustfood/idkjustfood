import { describe, expect, test } from "bun:test"

import {
  arrangeSections,
  groupBySection,
  parseImport,
  RecipeContentSchema,
  stepsInOrder,
  toJson,
  toMarkdown,
  toSchemaOrg,
  type RecipeContent,
} from "./index.js"

const base: RecipeContent = {
  title: "Pizza",
  description: "",
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  ingredients: [
    { name: "Flour", quantity: 200, unit: "g", note: null, section: "Dough" },
    { name: "Tomato", quantity: 3, unit: null, note: null, section: "Sauce" },
  ],
  steps: [
    { text: "Knead.", section: "Dough" },
    { text: "Simmer.", section: "Sauce" },
    { text: "Bake." },
  ],
  nutrition: { calories: null, protein: null, carbs: null, fat: null },
  source: { kind: "manual", label: null, url: null },
}

describe("groupBySection", () => {
  test("a list without sections is one group without a name", () => {
    const groups = groupBySection([{ text: "a", section: null }, { text: "b" }])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.name).toBeNull()
  })

  test("keeps the original index and orders by first appearance", () => {
    const groups = groupBySection([
      { section: "B" },
      { section: "A" },
      { section: "B" },
    ])
    expect(groups.map((g) => [g.name, g.items.map((i) => i.index)])).toEqual([
      ["B", [0, 2]],
      ["A", [1]],
    ])
  })

  test("arrangeSections leaves a plain list untouched", () => {
    const list = [{ text: "a", section: null }, { text: "b" }]
    expect(arrangeSections(list)).toBe(list)
  })

  test("stepsInOrder gives the cooking order with the section of each step", () => {
    const result = stepsInOrder([
      { text: "1", section: "A" },
      { text: "2", section: "B" },
      { text: "3", section: "A" },
    ])
    expect(result.map((r) => [r.step.text, r.section])).toEqual([
      ["1", "A"],
      ["3", "A"],
      ["2", "B"],
    ])
  })
})

describe("recipes with sections", () => {
  test("a recipe without any section field is still valid", () => {
    const plain = {
      ...base,
      ingredients: [{ name: "Salt", quantity: null, unit: null, note: null }],
      steps: [{ text: "Season." }],
    }
    expect(RecipeContentSchema.safeParse(plain).success).toBe(true)
  })

  test("markdown shows a headline per section and keeps the step numbers", () => {
    const md = toMarkdown(base)
    expect(md).toContain("### Dough\n\n- 200 g Flour")
    expect(md).toContain("### Sauce\n\n- 3 Tomato")
    expect(md).toContain("### Sauce\n\n2. Simmer.")
    expect(md).toContain("3. Bake.")
  })

  test("markdown of a recipe without sections has no headlines", () => {
    const md = toMarkdown({
      ...base,
      ingredients: [{ name: "Salt", quantity: null, unit: null, note: null }],
      steps: [{ text: "Season." }],
    })
    expect(md).not.toContain("###")
    expect(md).toContain("1. Season.")
  })

  test("JSON export and import keep the sections", () => {
    const result = parseImport(toJson(base))
    expect(result.ok && result.recipe.ingredients).toEqual(base.ingredients)
    expect(result.ok && result.recipe.steps).toEqual(base.steps)
  })

  test("schema.org export uses HowToSection and import reads it back", () => {
    const data = toSchemaOrg(base)
    const instructions = data.recipeInstructions as Record<string, unknown>[]
    expect(instructions[0]!["@type"]).toBe("HowToSection")
    const result = parseImport(JSON.stringify(data))
    expect(result.ok && result.recipe.steps).toEqual([
      { text: "Knead.", section: "Dough" },
      { text: "Simmer.", section: "Sauce" },
      { text: "Bake." },
    ])
    expect(result.ok && result.recipe.ingredients).toEqual(base.ingredients)
  })

  test("schema.org export without sections is a plain list of steps", () => {
    const data = toSchemaOrg({ ...base, steps: [{ text: "Bake." }] })
    expect(data.recipeInstructions).toEqual([
      { "@type": "HowToStep", text: "Bake." },
    ])
  })
})
