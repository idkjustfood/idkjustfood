import { describe, expect, test } from "bun:test"

import { daysIn, moveEnd, rangeFor } from "./planner-range"

describe("rangeFor", () => {
  test("next 2 and 3 days start today", () => {
    expect(rangeFor("next2", "2026-11-14", "2026-11-09")).toEqual({
      from: "2026-11-14",
      to: "2026-11-15",
    })
    expect(rangeFor("next3", "2026-12-30", "2026-12-28")).toEqual({
      from: "2026-12-30",
      to: "2027-01-01",
    })
  })
  test("this week is the shown week, the whole plan has no dates", () => {
    expect(rangeFor("week", "2026-11-14", "2026-11-09")).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    })
    expect(rangeFor("all", "2026-11-14", "2026-11-09")).toBeNull()
  })
})

describe("moveEnd", () => {
  const range = { from: "2026-11-14", to: "2026-11-16" }
  test("counts both ends", () => {
    expect(daysIn(range)).toBe(3)
    expect(daysIn({ from: "2026-11-14", to: "2026-11-14" })).toBe(1)
  })
  test("a single day is allowed", () => {
    expect(moveEnd(range, "to", -2)).toEqual({ from: "2026-11-14", to: "2026-11-14" })
  })
  test("ends never cross", () => {
    expect(moveEnd(range, "from", 5)).toEqual({ from: "2026-11-19", to: "2026-11-19" })
    expect(moveEnd(range, "to", -5)).toEqual({ from: "2026-11-11", to: "2026-11-11" })
  })
  test("the range stays below a year", () => {
    const moved = moveEnd(range, "to", 1000)
    expect(daysIn(moved)).toBe(366)
    expect(moved.from).toBe("2026-11-14")
  })
})
