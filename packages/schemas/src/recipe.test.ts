import { describe, expect, test } from "bun:test"

import {
  findTimers,
  formatAmount,
  formatCountdown,
  formatQuantity,
  fromSchemaOrg,
  parseImport,
  parseIngredientLine,
  parseQuantity,
  RecipeContentSchema,
  toJson,
  toMarkdown,
  toSchemaOrg,
  type RecipeContent,
} from "./index.js"

const pasta: RecipeContent = {
  title: "Creamy Tuscan chicken pasta",
  description: "A weeknight pasta.",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 90,
  tags: ["Italian", "Pasta"],
  ingredients: [
    { name: "Penne", quantity: 400, unit: "g", note: null },
    { name: "Chicken breast", quantity: 500, unit: "g", note: "cut in strips" },
    { name: "Garlic", quantity: 3, unit: "cloves", note: "minced" },
    { name: "Flour", quantity: 1.5, unit: "cups", note: null },
    { name: "Salt and pepper", quantity: null, unit: null, note: null },
  ],
  steps: [
    { text: "Cook the penne for 11 minutes." },
    { text: "Add the cream, then simmer 1 hour 30 minutes." },
  ],
  nutrition: { calories: 780, protein: 48.5, carbs: null, fat: 28 },
  source: { kind: "manual", label: null, url: null },
}

describe("parseQuantity", () => {
  test("reads what people type", () => {
    expect(parseQuantity("2")).toBe(2)
    expect(parseQuantity("1.5")).toBe(1.5)
    expect(parseQuantity("1,5")).toBe(1.5)
    expect(parseQuantity("1/2")).toBe(0.5)
    expect(parseQuantity("1 1/2")).toBe(1.5)
    expect(parseQuantity("½")).toBe(0.5)
    expect(parseQuantity("1½")).toBe(1.5)
  })

  test("empty stays empty, nonsense is rejected", () => {
    expect(parseQuantity("")).toBeNull()
    expect(parseQuantity("   ")).toBeNull()
    expect(parseQuantity("abc")).toBeUndefined()
    expect(parseQuantity("0")).toBeUndefined()
    expect(parseQuantity("1/0")).toBeUndefined()
  })
})

describe("formatQuantity", () => {
  test("uses fractions that read well", () => {
    expect(formatQuantity(1.5)).toBe("1½")
    expect(formatQuantity(0.75)).toBe("¾")
    expect(formatQuantity(1 / 3)).toBe("⅓")
    expect(formatQuantity(3)).toBe("3")
    expect(formatQuantity(3.97)).toBe("4")
    expect(formatQuantity(12.2)).toBe("12")
    expect(formatQuantity(250)).toBe("250")
    expect(formatQuantity(2.45)).toBe("2½")
    expect(formatQuantity(2.2)).toBe("2¼")
  })
})

describe("formatAmount", () => {
  test("an empty amount stays empty, however you scale it", () => {
    expect(formatAmount({ quantity: null, unit: null }, 2)).toBeNull()
    expect(formatAmount({ quantity: null, unit: "g" }, 2, "imperial")).toBeNull()
  })

  test("scales every amount", () => {
    const flour = { quantity: 200, unit: "g" }
    expect(formatAmount(flour, 6 / 4)).toBe("300 g")
    expect(formatAmount({ quantity: 3, unit: "cloves" }, 1.5)).toBe("4½ cloves")
    expect(formatAmount({ quantity: 2, unit: null }, 0.5)).toBe("1")
  })

  test("metric to imperial", () => {
    expect(formatAmount({ quantity: 100, unit: "g" }, 1, "imperial")).toBe(
      "3½ oz"
    )
    expect(formatAmount({ quantity: 500, unit: "g" }, 1, "imperial")).toBe(
      "1.1 lb"
    )
    expect(formatAmount({ quantity: 250, unit: "ml" }, 1, "imperial")).toBe(
      "1 cup"
    )
    expect(formatAmount({ quantity: 500, unit: "ml" }, 1, "imperial")).toBe(
      "2⅛ cups"
    )
    expect(formatAmount({ quantity: 30, unit: "ml" }, 1, "imperial")).toBe(
      "2 tbsp"
    )
    expect(formatAmount({ quantity: 5, unit: "ml" }, 1, "imperial")).toBe(
      "1 tsp"
    )
  })

  test("imperial to metric", () => {
    expect(formatAmount({ quantity: 1, unit: "cup" }, 1, "metric")).toBe(
      "235 ml"
    )
    expect(formatAmount({ quantity: 1.5, unit: "cups" }, 1, "metric")).toBe(
      "355 ml"
    )
    expect(formatAmount({ quantity: 8, unit: "oz" }, 1, "metric")).toBe("225 g")
    expect(formatAmount({ quantity: 3, unit: "lb" }, 1, "metric")).toBe(
      "1.36 kg"
    )
  })

  test("keeps amounts that are already in the chosen system", () => {
    expect(formatAmount({ quantity: 400, unit: "g" }, 1, "metric")).toBe(
      "400 g"
    )
    expect(formatAmount({ quantity: 2, unit: "cups" }, 1.5, "imperial")).toBe(
      "3 cups"
    )
    expect(formatAmount({ quantity: 2, unit: "tbsp" }, 1, "imperial")).toBe(
      "2 tbsp"
    )
    expect(formatAmount({ quantity: 2, unit: "tbsp" }, 1, "metric")).toBe(
      "2 tbsp"
    )
  })

  test("never converts units it does not know", () => {
    expect(formatAmount({ quantity: 2, unit: "handfuls" }, 1, "imperial")).toBe(
      "2 handfuls"
    )
  })
})

describe("findTimers", () => {
  test("finds times in plain text", () => {
    expect(findTimers("Bake for 30 minutes at 200 °C.")).toEqual([
      { seconds: 1800, label: "30 minutes" },
    ])
    expect(findTimers("Rest 10 min, then fry 45 seconds per side.")).toEqual([
      { seconds: 600, label: "10 min" },
      { seconds: 45, label: "45 seconds" },
    ])
    expect(findTimers("Simmer for 1½ hours")[0]?.seconds).toBe(5400)
    expect(findTimers("Cook ten minutes")[0]?.seconds).toBe(600)
    expect(findTimers("Leave for half an hour")[0]?.seconds).toBe(1800)
  })

  test("a range uses its lower end", () => {
    expect(findTimers("Bake 20-25 minutes")[0]?.seconds).toBe(1200)
    expect(findTimers("Bake 20 to 25 min")[0]?.seconds).toBe(1200)
  })

  test("joins hours and minutes into one timer", () => {
    expect(findTimers("Roast 1 hour 30 minutes.")).toEqual([
      { seconds: 5400, label: "1 hour 30 minutes" },
    ])
    expect(findTimers("Roast 2 hours and 15 minutes")[0]?.seconds).toBe(8100)
  })

  test("ignores text that is not a time", () => {
    expect(findTimers("Stir until smooth.")).toEqual([])
    expect(findTimers("Add 400 g of milk and 2 cups of flour")).toEqual([])
    expect(findTimers("Heat the oven to 200 degrees")).toEqual([])
    expect(findTimers("Use a hand mixer")).toEqual([])
  })

  test("formats a countdown", () => {
    expect(formatCountdown(1800)).toBe("30:00")
    expect(formatCountdown(65)).toBe("1:05")
    expect(formatCountdown(3725)).toBe("1:02:05")
    expect(formatCountdown(-3)).toBe("0:00")
  })
})

describe("export and import", () => {
  test("JSON comes back the same", () => {
    const result = parseImport(toJson(pasta))
    expect(result).toEqual({
      ok: true,
      recipe: { ...pasta, source: { kind: "import", label: null, url: null } },
    })
  })

  test("schema.org comes back the same", () => {
    const result = parseImport(JSON.stringify(toSchemaOrg(pasta)))
    expect(result).toEqual({
      ok: true,
      recipe: { ...pasta, source: { kind: "import", label: null, url: null } },
    })
  })

  test("schema.org is shaped like a Recipe other apps understand", () => {
    const out = toSchemaOrg(pasta)
    expect(out["@type"]).toBe("Recipe")
    expect(out.name).toBe(pasta.title)
    expect(out.cookTime).toBe("PT1H30M")
    expect(out.prepTime).toBe("PT10M")
    expect(out.recipeIngredient).toEqual([
      "400 g Penne",
      "500 g Chicken breast, cut in strips",
      "3 cloves Garlic, minced",
      "1.5 cups Flour",
      "Salt and pepper",
    ])
    expect(out.nutrition).toEqual({
      "@type": "NutritionInformation",
      calories: "780 kcal",
      proteinContent: "48.5 g",
      fatContent: "28 g",
    })
  })

  test("reads a recipe from a website", () => {
    const page = `<html><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "Kitchen" },
        {
          "@type": ["Recipe"],
          name: "Dal &amp; rice",
          recipeYield: ["4", "4 servings"],
          prepTime: "PT15M",
          cookTime: "PT1H",
          keywords: "Indian, Vegan",
          recipeIngredient: [
            "1 1/2 cups red lentils, rinsed",
            "2 tbsp curry powder",
            "Salt",
            "a handful of spinach",
          ],
          recipeInstructions: [
            {
              "@type": "HowToSection",
              itemListElement: [{ "@type": "HowToStep", text: "Rinse." }],
            },
            "Simmer 20 minutes.",
          ],
          nutrition: { calories: "310 calories", fatContent: "6.5 g" },
        },
      ],
    })}</script></html>`
    const result = parseImport(page)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe).toMatchObject({
      title: "Dal & rice",
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 60,
      tags: ["Indian", "Vegan"],
      steps: [{ text: "Rinse." }, { text: "Simmer 20 minutes." }],
      nutrition: { calories: 310, protein: null, carbs: null, fat: 6.5 },
    })
    expect(result.recipe.ingredients).toEqual([
      { name: "red lentils", quantity: 1.5, unit: "cups", note: "rinsed" },
      { name: "curry powder", quantity: 2, unit: "tbsp", note: null },
      { name: "Salt", quantity: null, unit: null, note: null },
      // No number, so no amount. We never guess one.
      { name: "a handful of spinach", quantity: null, unit: null, note: null },
    ])
  })

  test("says what is wrong with an import", () => {
    expect(parseImport("")).toMatchObject({ ok: false })
    expect(parseImport("not json")).toEqual({
      ok: false,
      error: "This is not valid JSON.",
    })
    expect(parseImport('{"title": 4}')).toMatchObject({ ok: false })
    expect(fromSchemaOrg({ "@type": "Recipe" })).toBeNull()
  })

  test("Markdown lists only what is set", () => {
    const md = toMarkdown(pasta)
    expect(md).toContain("# Creamy Tuscan chicken pasta")
    expect(md).toContain("**Servings:** 4 · **Prep:** 10 min · **Cooking:** 1 h 30 min")
    expect(md).toContain("- 400 g Penne")
    expect(md).toContain("- Salt and pepper")
    expect(md).toContain("2. Add the cream, then simmer 1 hour 30 minutes.")
    expect(md).toContain("- Calories: ~780 kcal")
    expect(md).not.toContain("Carbs")
  })
})

describe("parseIngredientLine", () => {
  test("splits amount, unit, name and note", () => {
    expect(parseIngredientLine("2 tablespoons olive oil")).toEqual({
      name: "olive oil",
      quantity: 2,
      unit: "tablespoons",
      note: null,
    })
    expect(parseIngredientLine("½ onion, chopped")).toEqual({
      name: "onion",
      quantity: 0.5,
      unit: null,
      note: "chopped",
    })
    expect(parseIngredientLine("")).toBeNull()
  })
})

describe("recipe schema", () => {
  test("accepts empty amounts and rejects a missing title", () => {
    expect(RecipeContentSchema.safeParse(pasta).success).toBe(true)
    expect(
      RecipeContentSchema.safeParse({ ...pasta, title: "  " }).success
    ).toBe(false)
    expect(
      RecipeContentSchema.safeParse({ ...pasta, servings: 0 }).success
    ).toBe(false)
  })
})
