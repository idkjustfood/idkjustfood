import { describe, expect, test } from "bun:test"

import { extractRecipe } from "../pipeline.js"
import { fakeAi, noAi } from "../testing.js"
import {
  blogWithGraph,
  brokenJson,
  incompleteData,
  instructionsAsText,
  plainPage,
  sectionsAndText,
} from "./fixtures.js"
import {
  durationMinutes,
  htmlToText,
  parseIngredientLine,
  yieldServings,
} from "./schema-org.js"

const page = (html: string) => async (url: string) => ({ url, html })
const link = (url = "https://cozy.example.com/lentil-soup") =>
  ({ type: "link", url }) as const

describe("pages with schema.org Recipe data", () => {
  test("a complete recipe needs no AI call", async () => {
    const recipe = await extractRecipe(link(), {
      ai: noAi,
      fetchPage: page(blogWithGraph),
    })

    expect(recipe.title).toBe("Best Lentil Soup & Bread")
    expect(recipe.description).toBe("A thick soup.")
    expect(recipe.servings).toBe(6)
    expect(recipe.prepMinutes).toBe(15)
    expect(recipe.cookMinutes).toBe(60)
    expect(recipe.tags).toEqual(["mediterranean", "soup", "vegan"])
    expect(recipe.steps.map((s) => s.text)).toEqual([
      "Heat the oil and cook the onion.",
      "Add lentils and 1 litre of water. Simmer for 30 minutes.",
    ])
    expect(recipe.source).toEqual({
      kind: "website",
      label: "cozy.example.com",
      url: "https://cozy.example.com/lentil-soup",
    })
  })

  test("ingredient lines become amount, unit, name and note", async () => {
    const { ingredients } = await extractRecipe(link(), {
      ai: noAi,
      fetchPage: page(blogWithGraph),
    })
    expect(ingredients).toEqual([
      { name: "red lentils", quantity: 1.5, unit: "cup", note: null },
      { name: "olive oil", quantity: 2, unit: "tbsp", note: null },
      { name: "large onion", quantity: 1, unit: null, note: "finely chopped" },
      { name: "garlic", quantity: 3, unit: "clove", note: null },
      // No amount in the source: the quantity stays empty.
      { name: "salt and pepper", quantity: null, unit: null, note: null },
      // A range is not turned into one number.
      { name: "2-3 carrots", quantity: null, unit: null, note: null },
      { name: "cumin", quantity: 0.5, unit: "tsp", note: null },
    ])
  })

  test("sections, a total time, and 'Serves 4'", async () => {
    const recipe = await extractRecipe(link(), {
      ai: noAi,
      fetchPage: page(sectionsAndText),
    })
    expect(recipe.title).toBe("Weeknight Pasta")
    expect(recipe.servings).toBe(4)
    expect(recipe.prepMinutes).toBeNull()
    expect(recipe.cookMinutes).toBe(30)
    expect(recipe.steps.map((s) => s.text)).toEqual([
      "Melt the butter.",
      "Boil the spaghetti for 10 minutes.",
    ])
  })

  test("instructions given as one HTML text are split into steps; servings stay unknown", async () => {
    const recipe = await extractRecipe(link(), {
      ai: noAi,
      fetchPage: page(instructionsAsText),
    })
    expect(recipe.steps.map((s) => s.text)).toEqual([
      "Put bread in the toaster.",
      "Wait 2 minutes.",
    ])
    expect(recipe.servings).toBe(1)
  })
})

describe("pages that need the AI", () => {
  test("a page without recipe data is read by the AI", async () => {
    const ai = fakeAi()
    const recipe = await extractRecipe(link("https://granny.example.com/pie"), {
      ai,
      fetchPage: page(plainPage),
    })
    expect(recipe.source.kind).toBe("website")
    const material = ai.calls.parseRecipe[0]!
    expect(material).toContain("1 kg apples")
    expect(material).toContain("Bake for 45 minutes.")
    // Scripts, styles, navigation and footer are not sent.
    expect(material).not.toContain("window.ads")
    expect(material).not.toContain("color: red")
    expect(material).not.toContain("Copyright")
  })

  test("incomplete recipe data is sent to the AI together with the page text", async () => {
    const ai = fakeAi()
    await extractRecipe(link(), { ai, fetchPage: page(incompleteData) })
    expect(ai.calls.parseRecipe).toHaveLength(1)
    expect(ai.calls.parseRecipe[0]).toContain("Mystery Stew")
    expect(ai.calls.parseRecipe[0]).toContain("simmer for 2 hours")
    expect(ai.calls.parseRecipe[0]).toContain("may be incomplete")
  })

  test("broken JSON-LD does not crash: the page text is used", async () => {
    const ai = fakeAi()
    await extractRecipe(link(), { ai, fetchPage: page(brokenJson) })
    expect(ai.calls.parseRecipe[0]).toContain("mix flour and water")
  })

  test("without an AI key the failure is clear", async () => {
    const { createAi } = await import("../ai/index.js")
    await expect(
      extractRecipe(link(), { ai: createAi({}), fetchPage: page(plainPage) })
    ).rejects.toMatchObject({ code: "ai_not_configured" })
  })
})

describe("web fetching", () => {
  test("a link to a local or private address is refused", async () => {
    // The built-in fetching is used here, so nothing leaves the machine.
    for (const url of [
      "http://localhost:3001/health",
      "http://127.0.0.1/",
      "http://169.254.169.254/",
    ]) {
      await expect(
        extractRecipe(link(url), { ai: noAi })
      ).rejects.toMatchObject({
        code: "private_address",
      })
    }
  })
})

describe("schema.org helpers", () => {
  test("durations", () => {
    expect(durationMinutes("PT1H30M")).toBe(90)
    expect(durationMinutes("PT45M")).toBe(45)
    expect(durationMinutes("P0DT20M")).toBe(20)
    expect(durationMinutes("P1DT2H")).toBe(26 * 60)
    expect(durationMinutes("PT0M")).toBeNull()
    expect(durationMinutes("1 hour")).toBeNull()
    expect(durationMinutes(undefined)).toBeNull()
  })

  test("yields", () => {
    expect(yieldServings("4 servings")).toBe(4)
    expect(yieldServings(["12", "12 cookies"])).toBe(12)
    expect(yieldServings(8)).toBe(8)
    expect(yieldServings("a few")).toBeNull()
  })

  test("ingredient lines", () => {
    expect(parseIngredientLine("200 g flour")).toEqual({
      name: "flour",
      quantity: 200,
      unit: "g",
      note: null,
    })
    expect(parseIngredientLine("½ cup sugar")).toMatchObject({
      quantity: 0.5,
      unit: "cup",
      name: "sugar",
    })
    expect(parseIngredientLine("1,5 kg potatoes")).toMatchObject({
      quantity: 1.5,
      unit: "kg",
    })
    expect(parseIngredientLine("2 EL Olivenöl")).toMatchObject({
      quantity: 2,
      unit: "tbsp",
      name: "Olivenöl",
    })
    // Not in the list: the amount stays and the word goes into the note.
    expect(parseIngredientLine("1 handful basil")).toEqual({
      name: "basil",
      quantity: 1,
      unit: null,
      note: "handful",
    })
    expect(parseIngredientLine("2 eggs")).toEqual({
      name: "eggs",
      quantity: 2,
      unit: null,
      note: null,
    })
    expect(parseIngredientLine("1 pinch of salt")).toMatchObject({
      quantity: 1,
      unit: "pinch",
      name: "salt",
    })
    expect(parseIngredientLine("Fresh basil")).toEqual({
      name: "Fresh basil",
      quantity: null,
      unit: null,
      note: null,
    })
    // "2025" is not a quantity range or unit: only the number is read.
    expect(parseIngredientLine("0 g water").quantity).toBeNull()
  })

  test("page text", () => {
    expect(
      htmlToText("<p>One</p><script>x()</script><p>Two &amp; three</p>")
    ).toBe("One\nTwo & three")
    expect(htmlToText("a".repeat(100), 10)).toHaveLength(10)
  })
})
