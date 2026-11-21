import { describe, expect, test } from "bun:test"

import {
  addMonths,
  CalendarEntryInputSchema,
  CalendarEntryUpdateSchema,
  entriesByDate,
  entriesOn,
  monthGrid,
  monthOf,
} from "./calendar.js"

describe("calendar entry input", () => {
  const valid = { title: "Dentist", color: "sky", date: "2026-11-21" }

  test("needs a title, a colour and a real day", () => {
    expect(CalendarEntryInputSchema.safeParse(valid).success).toBe(true)
    for (const bad of [
      { ...valid, title: "  " },
      { ...valid, color: "neon" },
      { ...valid, date: "2026-02-30" },
      { ...valid, date: "tomorrow" },
      { title: "Dentist", date: "2026-11-21" },
    ]) {
      expect(CalendarEntryInputSchema.safeParse(bad).success).toBe(false)
    }
  })

  test("trims the title", () => {
    const parsed = CalendarEntryInputSchema.parse({ ...valid, title: "  Dentist " })
    expect(parsed.title).toBe("Dentist")
  })

  test("an update may change one field", () => {
    expect(CalendarEntryUpdateSchema.safeParse({ color: "rose" }).success).toBe(true)
    expect(CalendarEntryUpdateSchema.safeParse({ date: "nope" }).success).toBe(false)
  })
})

describe("entries of a day", () => {
  const entries = [
    { id: "a", date: "2026-11-21" },
    { id: "b", date: "2026-11-22" },
    { id: "c", date: "2026-11-21" },
  ]

  test("entriesOn keeps the order and leaves other days out", () => {
    expect(entriesOn(entries, "2026-11-21").map((e) => e.id)).toEqual(["a", "c"])
    expect(entriesOn(entries, "2026-11-23")).toEqual([])
  })

  test("entriesByDate groups by day", () => {
    const byDate = entriesByDate(entries)
    expect(byDate.get("2026-11-21")?.length).toBe(2)
    expect(byDate.get("2026-11-22")?.length).toBe(1)
    expect(byDate.get("2026-11-23")).toBeUndefined()
  })
})

describe("months", () => {
  test("monthOf and addMonths cross year ends", () => {
    expect(monthOf("2026-11-21")).toBe("2026-11")
    expect(addMonths("2026-11", 1)).toBe("2026-12")
    expect(addMonths("2026-12", 1)).toBe("2027-01")
    expect(addMonths("2026-01", -1)).toBe("2025-12")
    expect(addMonths("2026-03", -15)).toBe("2024-12")
    expect(addMonths("2026-05", 0)).toBe("2026-05")
  })

  test("a month grid is whole weeks starting on Monday", () => {
    // November 2026 starts on a Sunday and ends on a Monday: 6 weeks.
    const grid = monthGrid("2026-11")
    expect(grid).toHaveLength(6)
    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(grid[0]![0]).toEqual({ date: "2026-10-26", inMonth: false })
    expect(grid[0]![6]).toEqual({ date: "2026-11-01", inMonth: true })
    expect(grid[5]![0]).toEqual({ date: "2026-11-30", inMonth: true })
    expect(grid[5]![6]).toEqual({ date: "2026-12-06", inMonth: false })
  })

  test("every day of the month is in the grid once", () => {
    const days = monthGrid("2026-02")
      .flat()
      .filter((day) => day.inMonth)
      .map((day) => day.date)
    expect(days).toHaveLength(28)
    expect(days[0]).toBe("2026-02-01")
    expect(days[27]).toBe("2026-02-28")
  })

  test("a month that fits four weeks has four rows", () => {
    // February 2027 starts on a Monday and has 28 days.
    expect(monthGrid("2027-02")).toHaveLength(4)
  })

  test("leap years have 29 days", () => {
    const days = monthGrid("2028-02").flat().filter((day) => day.inMonth)
    expect(days).toHaveLength(29)
  })
})
