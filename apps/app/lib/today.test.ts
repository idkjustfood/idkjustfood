import { describe, expect, test } from "bun:test"

import type { Meal } from "@workspace/schemas"

import { mealItems, shoppingItems, timeline } from "./today"

const meal = (id: string, date: string, slot: Meal["slot"]): Meal => ({
  id,
  date,
  slot,
  servings: 2,
  prep: null,
  recipe: {
    id: `r-${id}`,
    title: `Recipe ${id}`,
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    calories: null,
  },
})

describe("today timeline", () => {
  test("shows only today's meals, in the order of the day", () => {
    const items = mealItems(
      [
        meal("a", "2026-01-02", "breakfast"),
        meal("b", "2026-01-01", "afternoon"),
        meal("c", "2026-01-01", "breakfast"),
      ],
      "2026-01-01"
    )
    expect(items.map((i) => i.id)).toEqual(["c", "b"])
  })

  test("lists with nothing left to buy are left out", () => {
    const items = shoppingItems([
      { id: "1", name: "Weekly", items: [{ checked: false }, { checked: true }] },
      { id: "2", name: "Done", items: [{ checked: true }] },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ listId: "1", open: 1 })
  })

  test("meals come before shopping", () => {
    const all = timeline(
      [
        ...shoppingItems([{ id: "1", name: "L", items: [{ checked: false }] }]),
        ...mealItems([meal("a", "2026-01-01", "midday")], "2026-01-01"),
      ],
      []
    )
    expect(all.map((i) => i.kind)).toEqual(["meal", "shopping"])
  })

  test("items of switched-off modules are dropped", () => {
    const all = timeline(
      [
        ...shoppingItems([{ id: "1", name: "L", items: [{ checked: false }] }]),
        ...mealItems([meal("a", "2026-01-01", "midday")], "2026-01-01"),
      ],
      ["shopping"]
    )
    expect(all.map((i) => i.kind)).toEqual(["meal"])
  })
})
