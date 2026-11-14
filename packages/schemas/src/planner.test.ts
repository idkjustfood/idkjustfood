import { describe, expect, test } from "bun:test"

import {
  addDays,
  buildWeek,
  dayCalories,
  DateSchema,
  GeneratePlanSchema,
  weekStart,
  type Meal,
} from "./planner.js"

const meal = (
  date: string,
  slot: Meal["slot"],
  calories: number | null
): Meal => ({
  date,
  slot,
  servings: 2,
  recipe: {
    id: "r",
    title: "R",
    servings: 4,
    prepMinutes: null,
    cookMinutes: null,
    calories,
  },
})

describe("dates", () => {
  test("accepts real days only", () => {
    expect(DateSchema.safeParse("2026-02-28").success).toBe(true)
    expect(DateSchema.safeParse("2026-02-30").success).toBe(false)
    expect(DateSchema.safeParse("26-02-01").success).toBe(false)
  })

  test("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })

  test("weeks start on Monday", () => {
    expect(weekStart("2026-01-05")).toBe("2026-01-05") // a Monday
    expect(weekStart("2026-01-11")).toBe("2026-01-05") // the Sunday after
    expect(weekStart("2026-01-07")).toBe("2026-01-05")
  })
})

describe("buildWeek", () => {
  test("gives seven days with exactly three slots each", () => {
    const week = buildWeek([meal("2026-01-06", "midday", 500)], "2026-01-08")
    expect(week.start).toBe("2026-01-05")
    expect(week.days).toHaveLength(7)
    for (const day of week.days) {
      expect(Object.keys(day.slots)).toEqual([
        "breakfast",
        "midday",
        "afternoon",
      ])
    }
    expect(week.days[1]!.slots.midday?.recipe.calories).toBe(500)
    expect(week.days[1]!.slots.breakfast).toBeNull()
  })

  test("ignores meals of other weeks", () => {
    const week = buildWeek([meal("2026-01-13", "midday", 500)], "2026-01-05")
    expect(week.days.every((d) => d.slots.midday === null)).toBe(true)
  })
})

describe("dayCalories", () => {
  test("adds the estimates and counts meals without one", () => {
    expect(
      dayCalories([
        meal("d", "breakfast", 300),
        meal("d", "midday", null),
        null,
      ])
    ).toEqual({ calories: 300, missing: 1, planned: 2 })
  })
})

describe("GeneratePlanSchema", () => {
  test("fills in the defaults", () => {
    const parsed = GeneratePlanSchema.parse({
      goals: {},
      days: [{ date: "2026-01-05" }],
    })
    expect(parsed.servings).toBe(2)
    expect(parsed.overwrite).toBe(false)
  })
})
