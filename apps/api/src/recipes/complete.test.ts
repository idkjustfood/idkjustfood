import { beforeEach, describe, expect, test } from "bun:test"

import { fakeAi } from "@workspace/extraction/testing"
import type { Recipe, RecipeInput } from "@workspace/schemas"

import { createApp } from "../app.js"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string
let omar: string
let asked: { material: string; language?: string }[]
let answer: unknown

const dough = {
  ingredients: [
    { name: "Flour", quantity: 500, unit: "g", note: null, section: "Dough" },
    { name: "Yeast", quantity: null, unit: null, note: null, section: "Dough" },
  ],
  steps: [{ text: "Knead.", section: "Dough" }],
}

const sauce: RecipeInput = {
  title: "Pizza sauce",
  description: "",
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  ingredients: [{ name: "Tomatoes", quantity: 400, unit: "g", note: null }],
  steps: [{ text: "Simmer." }],
  nutrition: { calories: null, protein: null, carbs: null, fat: null },
}

async function create() {
  const res = await api.post("/api/recipes", olivia, sauce)
  return ((await res.json()) as { recipe: Recipe }).recipe
}

const complete = (id: string, body: object, cookie = olivia) =>
  api.post(`/api/recipes/${id}/complete`, cookie, body)

beforeEach(async () => {
  asked = []
  answer = dough
  const ai = fakeAi({
    parseRecipe: async (material, options) => {
      asked.push({ material, language: options?.language })
      return answer
    },
  })
  api = client(createApp(await createTestDb(), testEnv, { ai }))
  olivia = await api.signUp("Olivia")
  omar = await api.signUp("Omar")
})

describe("POST /recipes/:id/complete", () => {
  test("adds the dough, marks it, keeps the sauce and saves nothing", async () => {
    const recipe = await create()
    const res = await complete(recipe.id, {
      message: "add a pizza dough",
      language: "de",
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as {
      ingredients: { name: string }[]
      steps: { text: string }[]
      addedIngredients: number[]
      addedSteps: number[]
    }
    expect(result.ingredients.map((i) => i.name)).toEqual(["Tomatoes", "Flour", "Yeast"])
    expect(result.steps.map((s) => s.text)).toEqual(["Simmer.", "Knead."])
    expect(result.addedIngredients).toEqual([1, 2])
    expect(result.addedSteps).toEqual([1])
    expect(asked[0]?.language).toBe("de")
    expect(asked[0]?.material).toContain("add a pizza dough")

    const saved = await api.get(`/api/recipes/${recipe.id}`, olivia)
    const { recipe: after } = (await saved.json()) as { recipe: Recipe }
    expect(after.ingredients).toHaveLength(1)
    expect(after.steps).toHaveLength(1)
  })

  test("an empty message is rejected without calling the AI", async () => {
    const recipe = await create()
    expect((await complete(recipe.id, { message: "   " })).status).toBe(400)
    expect(asked).toHaveLength(0)
  })

  test("nothing to add is a clear 400", async () => {
    const recipe = await create()
    answer = { ingredients: [], steps: [] }
    const res = await complete(recipe.id, { message: "hi" })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe("nothing_to_add")
  })

  test("a failed AI call is reported as 502", async () => {
    const { ExtractionError } = await import("@workspace/extraction")
    const ai = fakeAi({
      parseRecipe: async () => {
        throw new ExtractionError("ai_failed", "The AI provider could not be reached.")
      },
    })
    api = client(createApp(await createTestDb(), testEnv, { ai }))
    olivia = await api.signUp("Olivia")
    const recipe = await create()
    expect((await complete(recipe.id, { message: "add rice" })).status).toBe(502)
  })

  test("someone else's recipe is not found, and you must be signed in", async () => {
    const recipe = await create()
    expect((await complete(recipe.id, { message: "add rice" }, omar)).status).toBe(404)
    expect((await complete(recipe.id, { message: "add rice" }, "")).status).toBe(401)
  })

  test("without a fake AI and without a key it answers 503", async () => {
    const real = client(createApp(await createTestDb(), testEnv))
    const cookie = await real.signUp("Olivia")
    const res = await real.post("/api/recipes", cookie, sauce)
    const { recipe } = (await res.json()) as { recipe: Recipe }
    const done = await real.post(`/api/recipes/${recipe.id}/complete`, cookie, {
      message: "add rice",
    })
    expect(done.status).toBe(503)
  })
})
