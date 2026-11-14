import { describe, expect, test } from "bun:test"

import { cardTags, filterTags, mealCounts, sortRecipes } from "./recipe-filters"

const r = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  tags: [] as string[],
  prepMinutes: null as number | null,
  cookMinutes: null as number | null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...extra,
})

describe("meal counts", () => {
  test("counts each meal and keeps untagged recipes under all", () => {
    const counts = mealCounts([
      r("a", { tags: ["breakfast", "vegan"] }),
      r("b", { tags: ["snack"] }),
      r("c"),
    ])
    expect(counts).toEqual({ all: 3, breakfast: 1, midday: 0, afternoon: 0, snack: 1 })
  })
})

describe("filter tags", () => {
  test("all adds no meal, a meal comes first", () => {
    expect(filterTags("all", ["vegan"])).toEqual(["vegan"])
    expect(filterTags("snack", ["vegan"])).toEqual(["snack", "vegan"])
  })
})

describe("sorting", () => {
  const list = [
    r("Zeta", { prepMinutes: 5, cookMinutes: 5, createdAt: "2026-01-02T00:00:00.000Z" }),
    r("Alpha"),
    r("Mid", { cookMinutes: 3 }),
  ]
  test("newest first", () => {
    expect(sortRecipes(list, "newest")[0]!.title).toBe("Zeta")
  })
  test("by title", () => {
    expect(sortRecipes(list, "title").map((x) => x.title)).toEqual(["Alpha", "Mid", "Zeta"])
  })
  test("quickest puts unknown times last", () => {
    expect(sortRecipes(list, "quickest").map((x) => x.title)).toEqual(["Mid", "Zeta", "Alpha"])
  })
})

describe("card tags", () => {
  test("shows two, meal first, and counts the rest", () => {
    expect(cardTags(["italian", "pasta", "vegan", "midday"])).toEqual({
      shown: ["midday", "italian"],
      more: 2,
    })
    expect(cardTags(["vegan"])).toEqual({ shown: ["vegan"], more: 0 })
  })
})
