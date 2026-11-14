import { describe, expect, test } from "bun:test"

import {
  emptyGoals,
  goalsProblem,
  plannedMeals,
  toGenerateRequest,
  wizardDays,
} from "./planner-wizard"

describe("wizardDays", () => {
  test("starts on the Monday of the week and plans every day", () => {
    const days = wizardDays("2026-01-08", 2, 3)
    expect(days).toHaveLength(14)
    expect(days[0]!.date).toBe("2026-01-05")
    expect(days[13]!.date).toBe("2026-01-18")
    expect(days.every((d) => d.plan && d.servings === 3)).toBe(true)
    expect(plannedMeals(days)).toBe(42)
  })
})

describe("goalsProblem", () => {
  test("accepts no goals and sensible goals", () => {
    expect(goalsProblem(emptyGoals)).toBeNull()
    expect(
      goalsProblem({ calories: "2000", diet: "vegan", maxMinutes: "30" })
    ).toBeNull()
  })

  test("explains what is wrong", () => {
    expect(goalsProblem({ ...emptyGoals, calories: "20" })).toMatch(/calories/i)
    expect(goalsProblem({ ...emptyGoals, calories: "lots" })).toMatch(
      /calories/i
    )
    expect(goalsProblem({ ...emptyGoals, maxMinutes: "0" })).toMatch(/minutes/i)
  })
})

describe("toGenerateRequest", () => {
  test("sends skipped days and meals as skipped and keeps each day's servings", () => {
    const days = wizardDays("2026-01-05", 1, 2)
    days[0]!.plan = false
    days[1]!.servings = 5
    days[2]!.slots.breakfast = false
    days[3]!.slots = { breakfast: false, midday: false, afternoon: false }

    const request = toGenerateRequest(
      { calories: "1800", diet: " vegetarian ", maxMinutes: "" },
      days,
      2,
      false
    )
    expect(request.goals).toEqual({
      caloriesPerDay: 1800,
      diet: "vegetarian",
      maxMinutes: null,
    })
    expect(request.days[0]).toEqual({ date: "2026-01-05", skip: true })
    expect(request.days[1]).toEqual({ date: "2026-01-06", servings: 5 })
    expect(request.days[2]).toEqual({
      date: "2026-01-07",
      servings: 2,
      skipSlots: ["breakfast"],
    })
    // A day with all meals off is a skipped day.
    expect(request.days[3]).toEqual({ date: "2026-01-08", skip: true })
    expect(request.servings).toBe(2)
    expect(request.overwrite).toBe(false)
  })
})
