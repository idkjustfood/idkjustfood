import { beforeEach, describe, expect, test } from "bun:test"

import type {
  GenerateResult,
  MealPlan,
  Recipe,
  RecipeInput,
  ShoppingList,
} from "@workspace/schemas"

import { createApp } from "../app.js"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

function recipeInput(
  title: string,
  extra: Partial<RecipeInput> = {}
): RecipeInput {
  return {
    title,
    description: "",
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 10,
    tags: [],
    ingredients: [
      { name: "Flour", quantity: 200, unit: "g", note: null },
      { name: "Salt", quantity: null, unit: null, note: null },
    ],
    steps: [{ text: "Mix." }],
    nutrition: { calories: 500, protein: null, carbs: null, fat: null },
    ...extra,
  }
}

async function makeRecipe(
  title: string,
  extra: Partial<RecipeInput> = {},
  cookie = olivia
) {
  const res = await api.post("/api/recipes", cookie, recipeInput(title, extra))
  expect(res.status).toBe(201)
  return (await body<{ recipe: Recipe }>(res)).recipe
}

async function makePlan(
  name = "Plan",
  cookie = olivia,
  extra: Record<string, unknown> = {}
) {
  const res = await api.post("/api/meal-plans", cookie, { name, ...extra })
  expect(res.status).toBe(201)
  return (await body<{ plan: MealPlan }>(res)).plan
}

async function getPlan(planId: string, cookie = olivia, query = "") {
  const res = await api.get(`/api/meal-plans/${planId}${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ plan: MealPlan }>(res)).plan
}

const slotPath = (planId: string, date: string, slot: string) =>
  `/api/meal-plans/${planId}/meals/${date}/${slot}`

async function setMeal(
  planId: string,
  date: string,
  slot: string,
  recipeId: string,
  servings?: number,
  cookie = olivia
) {
  return api.request("PUT", slotPath(planId, date, slot), cookie, {
    recipeId,
    servings,
  })
}

async function generate(
  planId: string,
  request: Record<string, unknown>,
  cookie = olivia
) {
  const res = await api.post(
    `/api/meal-plans/${planId}/generate`,
    cookie,
    request
  )
  expect(res.status).toBe(200)
  return body<GenerateResult>(res)
}

async function household(owner: string, ...names: string[]) {
  const res = await api.post("/api/households", owner, { name: "Home" })
  const id = (await body<{ household: { id: string } }>(res)).household.id
  const cookies: string[] = []
  for (const name of names) {
    const cookie = await api.signUp(name)
    const invite = await api.post(`/api/households/${id}/invites`, owner)
    const { invite: link } = await body<{ invite: { id: string } }>(invite)
    expect(
      (await api.post(`/api/invites/${link.id}/accept`, cookie)).status
    ).toBe(200)
    cookies.push(cookie)
  }
  return { id, cookies }
}

beforeEach(async () => {
  api = client(createApp(await createTestDb(), testEnv))
  olivia = await api.signUp("Olivia")
})

describe("meal plans", () => {
  test("need a signed-in user", async () => {
    expect((await api.get("/api/meal-plans")).status).toBe(401)
    expect(
      (await api.post("/api/meal-plans", undefined, { name: "A" })).status
    ).toBe(401)
    expect((await api.get("/api/meal-plans/abc")).status).toBe(401)
  })

  test("a personal plan can be made, read, renamed and deleted", async () => {
    const plan = await makePlan("Spring")
    expect(plan).toMatchObject({ name: "Spring", householdId: null, meals: [] })

    const list = await body<{ plans: MealPlan[] }>(
      await api.get("/api/meal-plans", olivia)
    )
    expect(list.plans.map((p) => p.id)).toEqual([plan.id])

    const renamed = await api.request(
      "PATCH",
      `/api/meal-plans/${plan.id}`,
      olivia,
      { name: "Summer" }
    )
    expect((await body<{ plan: MealPlan }>(renamed)).plan.name).toBe("Summer")

    expect((await api.del(`/api/meal-plans/${plan.id}`, olivia)).status).toBe(
      204
    )
    expect((await api.get(`/api/meal-plans/${plan.id}`, olivia)).status).toBe(
      404
    )
  })

  test("rejects an empty name", async () => {
    expect(
      (await api.post("/api/meal-plans", olivia, { name: " " })).status
    ).toBe(400)
  })

  test("making a plan with the same id twice gives the same plan", async () => {
    const id = crypto.randomUUID()
    const first = await makePlan("A", olivia, { id })
    const second = await makePlan("A", olivia, { id })
    expect(second.id).toBe(first.id)
  })

  test("a personal plan is invisible to others", async () => {
    const mia = await api.signUp("Mia")
    const plan = await makePlan()
    expect((await api.get(`/api/meal-plans/${plan.id}`, mia)).status).toBe(404)
    expect(
      (await body<{ plans: MealPlan[] }>(await api.get("/api/meal-plans", mia)))
        .plans
    ).toEqual([])
    expect(
      (
        await api.request("PATCH", `/api/meal-plans/${plan.id}`, mia, {
          name: "x",
        })
      ).status
    ).toBe(404)
    expect((await api.del(`/api/meal-plans/${plan.id}`, mia)).status).toBe(404)
  })
})

describe("meals", () => {
  test("a day has exactly the slots breakfast, midday and afternoon", async () => {
    const plan = await makePlan()
    const dal = await makeRecipe("Dal")
    for (const slot of ["breakfast", "midday", "afternoon"]) {
      expect((await setMeal(plan.id, "2026-01-05", slot, dal.id)).status).toBe(
        200
      )
    }
    expect(
      (await setMeal(plan.id, "2026-01-05", "evening", dal.id)).status
    ).toBe(400)
    expect((await getPlan(plan.id)).meals.map((m) => m.slot).sort()).toEqual([
      "afternoon",
      "breakfast",
      "midday",
    ])
  })

  test("a recipe can be planned, swapped, given other servings and removed", async () => {
    const plan = await makePlan()
    const dal = await makeRecipe("Dal")
    const pasta = await makeRecipe("Pasta")

    const set = await setMeal(plan.id, "2026-01-05", "midday", dal.id, 3)
    expect(set.status).toBe(200)
    expect((await body<{ plan: MealPlan }>(set)).plan.meals).toEqual([
      {
        date: "2026-01-05",
        slot: "midday",
        servings: 3,
        recipe: {
          id: dal.id,
          title: "Dal",
          servings: 4,
          prepMinutes: 10,
          cookMinutes: 10,
          calories: 500,
        },
      },
    ])

    // Swapping keeps one meal per slot.
    await setMeal(plan.id, "2026-01-05", "midday", pasta.id, 2)
    let meals = (await getPlan(plan.id)).meals
    expect(meals).toHaveLength(1)
    expect(meals[0]).toMatchObject({ servings: 2, recipe: { title: "Pasta" } })

    const servings = await api.request(
      "PATCH",
      slotPath(plan.id, "2026-01-05", "midday"),
      olivia,
      { servings: 6 }
    )
    expect(servings.status).toBe(200)
    expect((await getPlan(plan.id)).meals[0]!.servings).toBe(6)

    expect(
      (await api.del(slotPath(plan.id, "2026-01-05", "midday"), olivia)).status
    ).toBe(200)
    meals = (await getPlan(plan.id)).meals
    expect(meals).toEqual([])
    // Nothing left to remove or change.
    expect(
      (await api.del(slotPath(plan.id, "2026-01-05", "midday"), olivia)).status
    ).toBe(404)
    expect(
      (
        await api.request(
          "PATCH",
          slotPath(plan.id, "2026-01-05", "midday"),
          olivia,
          { servings: 2 }
        )
      ).status
    ).toBe(404)
  })

  test("rejects a date that is not a day, and bad servings", async () => {
    const plan = await makePlan()
    const dal = await makeRecipe("Dal")
    expect(
      (await setMeal(plan.id, "2026-02-30", "midday", dal.id)).status
    ).toBe(400)
    expect(
      (await setMeal(plan.id, "2026-01-05", "midday", dal.id, 0)).status
    ).toBe(400)
  })

  test("several weeks, also in the future, live in one plan", async () => {
    const plan = await makePlan()
    const dal = await makeRecipe("Dal")
    await setMeal(plan.id, "2026-01-05", "midday", dal.id)
    await setMeal(plan.id, "2026-01-12", "midday", dal.id)
    await setMeal(plan.id, "2031-06-02", "breakfast", dal.id)

    expect((await getPlan(plan.id)).meals.map((m) => m.date)).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2031-06-02",
    ])
    // One week at a time.
    const week = await getPlan(
      plan.id,
      olivia,
      "?from=2026-01-12&to=2026-01-18"
    )
    expect(week.meals.map((m) => m.date)).toEqual(["2026-01-12"])
  })

  test("a recipe you cannot see cannot be planned", async () => {
    const mia = await api.signUp("Mia")
    const secret = await makeRecipe("Secret", {}, mia)
    const plan = await makePlan()
    expect(
      (await setMeal(plan.id, "2026-01-05", "midday", secret.id)).status
    ).toBe(404)
  })

  test("deleting a recipe empties its slots", async () => {
    const plan = await makePlan()
    const dal = await makeRecipe("Dal")
    await setMeal(plan.id, "2026-01-05", "midday", dal.id)
    expect((await api.del(`/api/recipes/${dal.id}`, olivia)).status).toBe(204)
    expect((await getPlan(plan.id)).meals).toEqual([])
  })
})

describe("household plans", () => {
  test("members see and change a household plan, outsiders do not", async () => {
    const { id, cookies } = await household(olivia, "Noah")
    const [noah] = cookies as [string]
    const mia = await api.signUp("Mia")

    const plan = await makePlan("Family", olivia, { householdId: id })
    expect(plan.householdId).toBe(id)

    const dal = await makeRecipe("Dal", { householdId: id } as never)
    await setMeal(plan.id, "2026-01-05", "midday", dal.id)

    // Noah sees it in his list and can change it.
    const noahsPlans = await body<{ plans: MealPlan[] }>(
      await api.get("/api/meal-plans", noah)
    )
    expect(noahsPlans.plans.map((p) => p.id)).toEqual([plan.id])
    expect((await getPlan(plan.id, noah)).meals).toHaveLength(1)
    expect(
      (await setMeal(plan.id, "2026-01-06", "midday", dal.id, 2, noah)).status
    ).toBe(200)
    expect(
      (await api.del(slotPath(plan.id, "2026-01-05", "midday"), noah)).status
    ).toBe(200)
    expect((await getPlan(plan.id)).meals).toHaveLength(1)

    // Mia is not in the household.
    expect((await api.get(`/api/meal-plans/${plan.id}`, mia)).status).toBe(404)
    expect(
      (await setMeal(plan.id, "2026-01-07", "midday", dal.id, 2, mia)).status
    ).toBe(404)
  })

  test("only the household's recipes go into a household plan", async () => {
    const { id } = await household(olivia)
    const plan = await makePlan("Family", olivia, { householdId: id })
    const mine = await makeRecipe("Mine")
    const shared = await makeRecipe("Shared", { householdId: id } as never)
    expect(
      (await setMeal(plan.id, "2026-01-05", "midday", mine.id)).status
    ).toBe(404)
    expect(
      (await setMeal(plan.id, "2026-01-05", "midday", shared.id)).status
    ).toBe(200)
  })

  test("a personal plan can use the household's recipes", async () => {
    const { id } = await household(olivia)
    const plan = await makePlan()
    const shared = await makeRecipe("Shared", { householdId: id } as never)
    expect(
      (await setMeal(plan.id, "2026-01-05", "midday", shared.id)).status
    ).toBe(200)
  })

  test("cannot make a plan in a household you are not in", async () => {
    const mia = await api.signUp("Mia")
    const { id } = await household(mia)
    const res = await api.post("/api/meal-plans", olivia, {
      name: "Sneaky",
      householdId: id,
    })
    expect(res.status).toBe(404)
  })

  test("members cannot delete the plan, owners and its maker can", async () => {
    const { id, cookies } = await household(olivia, "Noah")
    const [noah] = cookies as [string]
    const plan = await makePlan("Family", noah, { householdId: id })
    // Olivia owns the household, Noah made the plan: both may delete it.
    const other = await makePlan("Other", olivia, { householdId: id })
    expect((await api.del(`/api/meal-plans/${other.id}`, noah)).status).toBe(
      403
    )
    expect((await api.del(`/api/meal-plans/${plan.id}`, olivia)).status).toBe(
      204
    )
    expect((await api.del(`/api/meal-plans/${other.id}`, olivia)).status).toBe(
      204
    )
  })

  test("a person who leaves loses access", async () => {
    const { id, cookies } = await household(olivia, "Noah")
    const [noah] = cookies as [string]
    const plan = await makePlan("Family", olivia, { householdId: id })
    expect((await api.post(`/api/households/${id}/leave`, noah)).status).toBe(
      204
    )
    expect((await api.get(`/api/meal-plans/${plan.id}`, noah)).status).toBe(404)
  })
})

describe("automatic planning", () => {
  const week = [
    "2026-01-05",
    "2026-01-06",
    "2026-01-07",
    "2026-01-08",
    "2026-01-09",
    "2026-01-10",
    "2026-01-11",
  ]

  test("fills a week from saved recipes, then it can be edited by hand", async () => {
    const plan = await makePlan()
    for (const title of ["A", "B", "C", "D", "E", "F"]) await makeRecipe(title)

    const result = await generate(plan.id, {
      goals: {},
      days: week.map((date) => ({ date })),
      servings: 3,
    })
    expect(result.unfilled).toEqual([])
    expect(result.plan.meals).toHaveLength(21)
    expect(result.plan.meals.every((m) => m.servings === 3)).toBe(true)

    // Change one by hand afterwards.
    const swap = await makeRecipe("Handmade")
    await setMeal(plan.id, "2026-01-05", "breakfast", swap.id, 1)
    const after = await getPlan(plan.id)
    expect(
      after.meals.find((m) => m.date === "2026-01-05" && m.slot === "breakfast")
    ).toMatchObject({ servings: 1, recipe: { title: "Handmade" } })
  })

  test("skipped days and skipped meals stay empty, and a day can have its own servings", async () => {
    const plan = await makePlan()
    for (const title of ["A", "B", "C"]) await makeRecipe(title)

    const result = await generate(plan.id, {
      goals: {},
      servings: 2,
      days: [
        { date: "2026-01-05", skip: true },
        { date: "2026-01-06", skipSlots: ["breakfast"], servings: 5 },
        { date: "2026-01-07" },
      ],
    })
    const meals = result.plan.meals
    expect(meals.filter((m) => m.date === "2026-01-05")).toEqual([])
    expect(
      meals.filter((m) => m.date === "2026-01-06").map((m) => m.slot)
    ).toEqual(["midday", "afternoon"])
    expect(
      meals
        .filter((m) => m.date === "2026-01-06")
        .every((m) => m.servings === 5)
    ).toBe(true)
    expect(
      meals
        .filter((m) => m.date === "2026-01-07")
        .every((m) => m.servings === 2)
    ).toBe(true)
    // Skipping on purpose is not reported as a gap.
    expect(result.unfilled).toEqual([])
  })

  test("follows goals for diet, cooking time and calories", async () => {
    const plan = await makePlan()
    await makeRecipe("Veg quick", { tags: ["Vegetarian"], nutrition: n(450) })
    await makeRecipe("Veg slow", {
      tags: ["vegetarian"],
      prepMinutes: 60,
      cookMinutes: 60,
      nutrition: n(450),
    })
    await makeRecipe("Veg quick 2", { tags: ["vegetarian"], nutrition: n(600) })
    await makeRecipe("Meat quick", { nutrition: n(500) })
    await makeRecipe("Veg unknown calories", {
      tags: ["vegetarian"],
      nutrition: n(null),
    })

    const result = await generate(plan.id, {
      goals: { diet: "vegetarian", maxMinutes: 30, caloriesPerDay: 1500 },
      days: [{ date: "2026-01-05" }],
    })
    const titles = result.plan.meals.map((m) => m.recipe.title)
    expect(titles.sort()).toEqual(["Veg quick", "Veg quick 2"])
    expect(result.notes.join(" ")).toMatch(/estimate/i)
    // The third slot has no matching recipe: it stays empty and says so.
    expect(result.unfilled).toHaveLength(1)
    expect(result.unfilled[0]!.reason).toMatch(/no matching recipe/i)
  })

  test("says so and leaves everything empty when there are no recipes", async () => {
    const plan = await makePlan()
    const result = await generate(plan.id, {
      goals: {},
      days: [{ date: "2026-01-05" }],
    })
    expect(result.plan.meals).toEqual([])
    expect(result.unfilled).toHaveLength(3)
    expect(result.unfilled[0]!.reason).toMatch(/no saved recipes/i)
  })

  test("keeps planned meals unless told to overwrite", async () => {
    const plan = await makePlan()
    const mine = await makeRecipe("Mine")
    for (const title of ["A", "B", "C"]) await makeRecipe(title)
    await setMeal(plan.id, "2026-01-05", "midday", mine.id, 1)

    const kept = await generate(plan.id, {
      goals: {},
      days: [{ date: "2026-01-05" }],
    })
    expect(kept.plan.meals.find((m) => m.slot === "midday")!.recipe.title).toBe(
      "Mine"
    )
    expect(kept.plan.meals).toHaveLength(3)

    const replaced = await generate(plan.id, {
      goals: {},
      overwrite: true,
      days: [{ date: "2026-01-05" }],
    })
    expect(replaced.plan.meals).toHaveLength(3)
    expect(replaced.plan.meals.find((m) => m.slot === "midday")!.servings).toBe(
      2
    )
  })

  test("overwrite empties slots that find no recipe", async () => {
    const plan = await makePlan()
    const big = await makeRecipe("Big", { nutrition: n(5000) })
    await setMeal(plan.id, "2026-01-05", "midday", big.id)
    const result = await generate(plan.id, {
      goals: { caloriesPerDay: 1500 },
      overwrite: true,
      days: [{ date: "2026-01-05" }],
    })
    expect(result.plan.meals).toEqual([])
    expect(result.unfilled).toHaveLength(3)
  })

  test("a household plan uses only the household's recipes", async () => {
    const { id } = await household(olivia)
    const plan = await makePlan("Family", olivia, { householdId: id })
    await makeRecipe("Private")
    await makeRecipe("Shared", { householdId: id } as never)
    const result = await generate(plan.id, {
      goals: {},
      days: [{ date: "2026-01-05" }],
    })
    expect(result.plan.meals.map((m) => m.recipe.title)).toEqual(["Shared"])
  })

  test("is the same every time", async () => {
    const one = await makePlan("One")
    const two = await makePlan("Two")
    for (const title of ["A", "B", "C", "D"]) await makeRecipe(title)
    const request = { goals: {}, days: week.map((date) => ({ date })) }
    const a = await generate(one.id, request)
    const b = await generate(two.id, request)
    const pick = (r: GenerateResult) =>
      r.plan.meals.map((m) => [m.date, m.slot, m.recipe.title])
    expect(pick(a)).toEqual(pick(b))
  })

  test("rejects a request without days", async () => {
    const plan = await makePlan()
    const res = await api.post(`/api/meal-plans/${plan.id}/generate`, olivia, {
      goals: {},
      days: [],
    })
    expect(res.status).toBe(400)
  })
})

function n(calories: number | null) {
  return { calories, protein: null, carbs: null, fat: null }
}

describe("shopping list", () => {
  async function makeList(
    cookie = olivia,
    extra: Record<string, unknown> = {}
  ) {
    const res = await api.post("/api/shopping-lists", cookie, {
      name: "Shop",
      ...extra,
    })
    return (await body<{ list: ShoppingList }>(res)).list
  }

  async function listOf(id: string, cookie = olivia) {
    const res = await api.get(`/api/shopping-lists/${id}`, cookie)
    return (await body<{ list: ShoppingList }>(res)).list
  }

  test("nothing reaches a list until the button is used", async () => {
    const plan = await makePlan()
    const list = await makeList()
    const dal = await makeRecipe("Dal")
    await setMeal(plan.id, "2026-01-05", "midday", dal.id)
    await generate(plan.id, { goals: {}, days: [{ date: "2026-01-06" }] })
    expect((await listOf(list.id)).items).toEqual([])
  })

  test("adds the scaled, merged ingredients of all meals", async () => {
    const plan = await makePlan()
    const list = await makeList()
    const dal = await makeRecipe("Dal") // 4 servings, 200 g flour
    const pasta = await makeRecipe("Pasta", {
      servings: 2,
      ingredients: [{ name: "flour", quantity: 100, unit: "g", note: null }],
    })
    await setMeal(plan.id, "2026-01-05", "midday", dal.id, 8) // 400 g
    await setMeal(plan.id, "2026-01-06", "midday", pasta.id, 1) // 50 g
    await setMeal(plan.id, "2026-01-13", "midday", dal.id, 4) // another week

    const res = await api.post(
      `/api/meal-plans/${plan.id}/shopping-list`,
      olivia,
      {
        listId: list.id,
        from: "2026-01-05",
        to: "2026-01-11",
      }
    )
    expect(res.status).toBe(200)
    expect(await body(res)).toEqual({ listId: list.id, added: 2 })

    const items = (await listOf(list.id)).items
    expect(items.find((i) => i.name === "Flour")).toMatchObject({
      quantity: 450,
      unit: "g",
      fromRecipes: ["Dal", "Pasta"],
    })
    // Salt has no amount and stays without one.
    expect(items.find((i) => i.name === "Salt")?.quantity).toBeNull()

    // Without a range, the whole plan is added.
    await api.post(`/api/meal-plans/${plan.id}/shopping-list`, olivia, {
      listId: list.id,
    })
    expect(
      (await listOf(list.id)).items.find((i) => i.name === "Flour")?.quantity
    ).toBe(450 + 450 + 200)
  })

  test("needs access to the plan and to the list", async () => {
    const mia = await api.signUp("Mia")
    const plan = await makePlan()
    const miasList = await makeList(mia)
    const res = await api.post(
      `/api/meal-plans/${plan.id}/shopping-list`,
      olivia,
      {
        listId: miasList.id,
      }
    )
    expect(res.status).toBe(404)

    const mine = await makeList()
    const other = await api.post(
      `/api/meal-plans/${plan.id}/shopping-list`,
      mia,
      {
        listId: miasList.id,
      }
    )
    expect(other.status).toBe(404)
    expect((await listOf(mine.id)).items).toEqual([])
  })

  test("a household member can put a household plan on a household list", async () => {
    const { id, cookies } = await household(olivia, "Noah")
    const [noah] = cookies as [string]
    const plan = await makePlan("Family", olivia, { householdId: id })
    const dal = await makeRecipe("Dal", { householdId: id } as never)
    await setMeal(plan.id, "2026-01-05", "midday", dal.id, 4)
    const list = await makeList(olivia, { householdId: id })
    const res = await api.post(
      `/api/meal-plans/${plan.id}/shopping-list`,
      noah,
      {
        listId: list.id,
      }
    )
    expect(res.status).toBe(200)
    expect((await listOf(list.id, noah)).items).toHaveLength(2)
  })
})
