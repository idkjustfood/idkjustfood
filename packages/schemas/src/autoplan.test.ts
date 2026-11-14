import { describe, expect, test } from "bun:test"

import { autoPlan, type PlannableRecipe } from "./autoplan.js"

function recipe(
  id: string,
  extra: Partial<PlannableRecipe> = {}
): PlannableRecipe {
  return {
    id,
    title: id,
    tags: [],
    calories: 500,
    prepMinutes: 10,
    cookMinutes: 10,
    ...extra,
  }
}

const monday = { date: "2026-01-05" }
const tuesday = { date: "2026-01-06" }

describe("autoPlan", () => {
  test("fills all three slots of a day", () => {
    const result = autoPlan({
      recipes: [recipe("a"), recipe("b"), recipe("c")],
      goals: {},
      days: [monday],
      servings: 2,
    })
    expect(result.meals.map((m) => m.slot)).toEqual([
      "breakfast",
      "midday",
      "afternoon",
    ])
    expect(result.unfilled).toEqual([])
    expect(result.meals.every((m) => m.servings === 2)).toBe(true)
  })

  test("is deterministic", () => {
    const input = {
      recipes: [recipe("a"), recipe("b"), recipe("c"), recipe("d")],
      goals: { caloriesPerDay: 1800 },
      days: [monday, tuesday],
      servings: 1,
    }
    expect(autoPlan(input)).toEqual(autoPlan(input))
  })

  test("leaves skipped days and skipped meals empty", () => {
    const result = autoPlan({
      recipes: [recipe("a"), recipe("b"), recipe("c")],
      goals: {},
      days: [
        { date: "2026-01-05", skip: true },
        { date: "2026-01-06", skipSlots: ["breakfast", "afternoon"] },
      ],
      servings: 2,
    })
    expect(result.meals).toHaveLength(1)
    expect(result.meals[0]).toMatchObject({
      date: "2026-01-06",
      slot: "midday",
    })
    // Skipped on purpose is not "missing recipes".
    expect(result.unfilled).toEqual([])
  })

  test("uses the servings of a single day", () => {
    const result = autoPlan({
      recipes: [recipe("a"), recipe("b"), recipe("c")],
      goals: {},
      days: [{ date: "2026-01-05", servings: 6 }, tuesday],
      servings: 2,
    })
    const on = (date: string) =>
      result.meals.filter((m) => m.date === date).map((m) => m.servings)
    expect(on("2026-01-05")).toEqual([6, 6, 6])
    expect(on("2026-01-06")).toEqual([2, 2, 2])
  })

  test("says so and leaves slots empty when there are no recipes", () => {
    const result = autoPlan({
      recipes: [],
      goals: {},
      days: [monday],
      servings: 2,
    })
    expect(result.meals).toEqual([])
    expect(result.unfilled).toHaveLength(3)
    expect(result.unfilled[0]!.reason).toMatch(/no saved recipes/i)
  })

  test("only uses recipes with the wanted diet tag", () => {
    const result = autoPlan({
      recipes: [
        recipe("meat", { tags: ["Dinner"] }),
        recipe("veg1", { tags: ["Vegetarian"] }),
        recipe("veg2", { tags: ["vegetarian"] }),
      ],
      goals: { diet: "vegetarian" },
      days: [monday],
      servings: 2,
    })
    const ids = result.meals.map((m) => m.recipeId)
    expect(ids).not.toContain("meat")
    // Two matching recipes, and one recipe is not used twice in a day.
    expect(ids.length).toBe(2)
  })

  test("skips recipes that take too long, and those with unknown times", () => {
    const result = autoPlan({
      recipes: [
        recipe("slow", { prepMinutes: 30, cookMinutes: 60 }),
        recipe("unknown", { prepMinutes: null, cookMinutes: null }),
        recipe("quick", { prepMinutes: 5, cookMinutes: 10 }),
      ],
      goals: { maxMinutes: 20 },
      days: [monday],
      servings: 2,
    })
    expect(new Set(result.meals.map((m) => m.recipeId))).toEqual(
      new Set(["quick"])
    )
    expect(result.notes.join(" ")).toMatch(/no cooking time/i)
  })

  test("a recipe with only one of prep or cook time counts that time", () => {
    const result = autoPlan({
      recipes: [recipe("half", { prepMinutes: 15, cookMinutes: null })],
      goals: { maxMinutes: 20 },
      days: [monday],
      servings: 2,
    })
    expect(result.meals.map((m) => m.recipeId)).toEqual(["half"])
  })

  test("aims at the calorie goal and skips recipes without an estimate", () => {
    const result = autoPlan({
      recipes: [
        recipe("light", { calories: 300 }),
        recipe("hearty", { calories: 700 }),
        recipe("huge", { calories: 1800 }),
        recipe("unknown", { calories: null }),
      ],
      goals: { caloriesPerDay: 1500 },
      days: [monday],
      servings: 1,
    })
    const ids = result.meals.map((m) => m.recipeId)
    expect(ids).not.toContain("huge")
    expect(ids).not.toContain("unknown")
    expect(result.notes.join(" ")).toMatch(/no calorie estimate/i)
    // Breakfast gets the light recipe, midday the hearty one.
    expect(result.meals.map((m) => [m.slot, m.recipeId])).toEqual([
      ["breakfast", "light"],
      ["midday", "hearty"],
    ])
    expect(result.unfilled.map((u) => u.slot)).toEqual(["afternoon"])
  })

  test("leaves slots empty instead of inventing meals when nothing fits", () => {
    const result = autoPlan({
      recipes: [recipe("huge", { calories: 3000 })],
      goals: { caloriesPerDay: 1500 },
      days: [monday],
      servings: 1,
    })
    expect(result.meals).toEqual([])
    expect(result.unfilled).toHaveLength(3)
    expect(result.unfilled[0]!.reason).toMatch(/no matching recipe/i)
  })

  test("varies the meals instead of repeating one recipe", () => {
    const result = autoPlan({
      recipes: [recipe("a"), recipe("b"), recipe("c"), recipe("d")],
      goals: {},
      days: [monday, tuesday],
      servings: 2,
    })
    const ids = result.meals.map((m) => m.recipeId)
    expect(ids.length).toBe(6)
    // Four recipes for six slots: nothing is used more than twice.
    for (const id of new Set(ids)) {
      expect(ids.filter((x) => x === id).length).toBeLessThanOrEqual(2)
    }
    // The same recipe is never in two slots of one day.
    for (const date of ["2026-01-05", "2026-01-06"]) {
      const day = result.meals.filter((m) => m.date === date)
      expect(new Set(day.map((m) => m.recipeId)).size).toBe(day.length)
    }
  })

  test("keeps meal-time tags in their slots", () => {
    const result = autoPlan({
      recipes: [
        recipe("porridge", { tags: ["Breakfast"] }),
        recipe("stew", { tags: ["Dinner"] }),
        recipe("salad", { tags: ["Lunch"] }),
      ],
      goals: {},
      days: [monday],
      servings: 2,
    })
    const at = (slot: string) =>
      result.meals.find((m) => m.slot === slot)?.recipeId
    expect(at("breakfast")).toBe("porridge")
    expect(at("midday")).toBe("salad")
    expect(at("afternoon")).toBe("stew")
  })

  test("a breakfast recipe is never planned for dinner", () => {
    const result = autoPlan({
      recipes: [recipe("porridge", { tags: ["breakfast"] })],
      goals: {},
      days: [monday],
      servings: 2,
    })
    expect(result.meals.map((m) => m.slot)).toEqual(["breakfast"])
    expect(result.unfilled.map((u) => u.slot)).toEqual(["midday", "afternoon"])
  })

  test("does not touch slots that are already planned, and counts their calories", () => {
    const result = autoPlan({
      recipes: [
        recipe("light", { calories: 400 }),
        recipe("fine", { calories: 420 }),
        recipe("big", { calories: 900 }),
      ],
      goals: { caloriesPerDay: 1400 },
      days: [monday],
      servings: 1,
      existing: [
        {
          date: "2026-01-05",
          slot: "midday",
          recipeId: "other",
          calories: 600,
        },
      ],
    })
    expect(result.meals.map((m) => m.slot)).toEqual(["breakfast", "afternoon"])
  })
})
