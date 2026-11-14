import { describe, expect, test } from "bun:test"

import { prepRequest, prepSlots } from "./meal-prep"

describe("prepSlots", () => {
  test("starts after the cooking meal on the same day", () => {
    const slots = prepSlots("2026-01-04", "midday", 1)
    expect(slots.map((s) => `${s.date} ${s.slot}`)).toEqual([
      "2026-01-04 afternoon",
      "2026-01-05 breakfast",
      "2026-01-05 midday",
      "2026-01-05 afternoon",
    ])
  })

  test("a meal cooked in the afternoon only has later days", () => {
    const slots = prepSlots("2026-01-31", "afternoon", 1)
    expect(slots[0]).toEqual({ date: "2026-02-01", slot: "breakfast" })
  })

  test("covers a week by default", () => {
    expect(prepSlots("2026-01-04", "breakfast")).toHaveLength(2 + 7 * 3)
  })
})

describe("prepRequest", () => {
  test("lists the chosen slots in the order they happen", () => {
    const request = prepRequest({
      recipeId: "r",
      date: "2026-01-04",
      slot: "midday",
      servings: 1,
      leftoverServings: 2,
      chosen: [
        { date: "2026-01-06", slot: "breakfast" },
        { date: "2026-01-05", slot: "afternoon" },
        { date: "2026-01-05", slot: "breakfast" },
      ],
    })
    expect(request.eat).toEqual([
      { date: "2026-01-05", slot: "breakfast", servings: 2 },
      { date: "2026-01-05", slot: "afternoon", servings: 2 },
      { date: "2026-01-06", slot: "breakfast", servings: 2 },
    ])
    expect(request).toMatchObject({ recipeId: "r", servings: 1 })
  })
})
