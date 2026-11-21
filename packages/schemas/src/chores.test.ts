import { describe, expect, test } from "bun:test"

import {
  ChoreDaySchema,
  ChoreInputSchema,
  ChoreUpdateSchema,
  choreDueDay,
  daysUntilDue,
  isChoreDue,
  localDay,
  splitChores,
} from "./chores.js"

const chore = (intervalDays: number, lastDoneOn: string | null) => ({
  intervalDays,
  lastDoneOn,
})

describe("when a chore is due", () => {
  test("a chore that was never checked is due right away", () => {
    expect(isChoreDue(chore(3, null), "2026-11-21")).toBe(true)
    expect(choreDueDay(chore(3, null))).toBeNull()
    expect(daysUntilDue(chore(3, null), "2026-11-21")).toBeNull()
  })

  test("checked today with 3 days: hidden for 2 days, back on day 3 at 00:00", () => {
    const done = chore(3, "2026-11-21")
    expect(choreDueDay(done)).toBe("2026-11-24")
    expect(isChoreDue(done, "2026-11-21")).toBe(false)
    expect(isChoreDue(done, "2026-11-22")).toBe(false)
    expect(isChoreDue(done, "2026-11-23")).toBe(false)
    expect(isChoreDue(done, "2026-11-24")).toBe(true)
    expect(isChoreDue(done, "2026-11-25")).toBe(true)
  })

  test("every day: checked today, back tomorrow", () => {
    const done = chore(1, "2026-11-21")
    expect(isChoreDue(done, "2026-11-21")).toBe(false)
    expect(isChoreDue(done, "2026-11-22")).toBe(true)
  })

  test("counts the days until it is due", () => {
    const done = chore(3, "2026-11-21")
    expect(daysUntilDue(done, "2026-11-21")).toBe(3)
    expect(daysUntilDue(done, "2026-11-23")).toBe(1)
    expect(daysUntilDue(done, "2026-11-24")).toBe(0)
    expect(daysUntilDue(done, "2026-11-26")).toBe(-2)
  })

  test("works across the end of a month and a year", () => {
    expect(choreDueDay(chore(3, "2026-11-29"))).toBe("2026-12-02")
    expect(choreDueDay(chore(2, "2026-12-31"))).toBe("2027-01-02")
    expect(choreDueDay(chore(1, "2028-02-28"))).toBe("2028-02-29")
    expect(choreDueDay(chore(1, "2027-02-28"))).toBe("2027-03-01")
  })

  test("is not thrown off by summer time", () => {
    // The clocks change on 2026-03-29 (Europe) and 2026-11-01 (US).
    expect(choreDueDay(chore(3, "2026-03-28"))).toBe("2026-03-31")
    expect(choreDueDay(chore(3, "2026-10-31"))).toBe("2026-11-03")
  })
})

describe("localDay", () => {
  test("is the date on the device, whatever the time", () => {
    expect(localDay(new Date(2026, 10, 21, 14, 0))).toBe("2026-11-21")
    expect(localDay(new Date(2026, 10, 21, 0, 0, 0))).toBe("2026-11-21")
    expect(localDay(new Date(2026, 10, 21, 23, 59, 59))).toBe("2026-11-21")
    expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05")
  })

  test("checked at 14:00, back after 2 days and the remaining hours", () => {
    const checked = localDay(new Date(2026, 10, 21, 14, 0))
    const done = chore(3, checked)
    expect(isChoreDue(done, localDay(new Date(2026, 10, 23, 23, 59)))).toBe(
      false
    )
    expect(isChoreDue(done, localDay(new Date(2026, 10, 24, 0, 0)))).toBe(true)
  })
})

describe("splitChores", () => {
  test("separates due chores from waiting ones, soonest first", () => {
    const list = [
      { name: "Windows", ...chore(7, "2026-11-20") },
      { name: "Towels", ...chore(3, "2026-11-21") },
      { name: "Bins", ...chore(1, "2026-11-20") },
      { name: "Fridge", ...chore(14, null) },
    ]
    const { due, later } = splitChores(list, "2026-11-21")
    expect(due.map((c) => c.name)).toEqual(["Bins", "Fridge"])
    expect(later.map((c) => c.name)).toEqual(["Towels", "Windows"])
  })
})

describe("schemas", () => {
  test("a day must be a real date", () => {
    expect(ChoreDaySchema.safeParse("2026-11-21").success).toBe(true)
    expect(ChoreDaySchema.safeParse("2026-02-30").success).toBe(false)
    expect(ChoreDaySchema.safeParse("21.11.2026").success).toBe(false)
    expect(ChoreDaySchema.safeParse("2026-11-21T14:00:00Z").success).toBe(false)
  })

  test("the interval is a whole number of days, at least 1", () => {
    const base = { name: "Towels" }
    expect(ChoreInputSchema.safeParse({ ...base, intervalDays: 3 }).success).toBe(true)
    expect(ChoreInputSchema.safeParse({ ...base, intervalDays: 0 }).success).toBe(false)
    expect(ChoreInputSchema.safeParse({ ...base, intervalDays: 1.5 }).success).toBe(false)
    expect(ChoreInputSchema.safeParse({ ...base, intervalDays: 366 }).success).toBe(false)
    expect(ChoreInputSchema.safeParse({ name: " ", intervalDays: 3 }).success).toBe(false)
  })

  test("an update may clear the last day", () => {
    expect(ChoreUpdateSchema.safeParse({ lastDoneOn: null }).success).toBe(true)
    expect(ChoreUpdateSchema.safeParse({ lastDoneOn: "2026-11-21" }).success).toBe(true)
  })
})
