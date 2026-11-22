import { describe, expect, test } from "bun:test"

import type { Chore } from "@workspace/schemas"

import { applyChoreOp, applyChoreOps } from "./chore-ops"
import { choreComesBack, msUntilNextDay } from "./chore-view"

const towels: Chore = {
  id: "t",
  name: "Switch towels",
  intervalDays: 3,
  lastDoneOn: null,
  kind: "chore",
  householdId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

describe("applyChoreOp", () => {
  test("adds a chore that is due right away", () => {
    const [chore] = applyChoreOp([], {
      type: "add",
      id: "a",
      name: "Bins",
      intervalDays: 7,
      householdId: "h",
    })
    expect(chore).toMatchObject({
      id: "a",
      name: "Bins",
      intervalDays: 7,
      lastDoneOn: null,
      householdId: "h",
    })
  })

  test("a task has the kind it was added with, and is a chore without one", () => {
    const add = { type: "add" as const, name: "x", intervalDays: 1, householdId: null }
    expect(applyChoreOp([], { ...add, id: "p", kind: "plant" })[0]?.kind).toBe("plant")
    expect(applyChoreOp([], { ...add, id: "q" })[0]?.kind).toBe("chore")
  })

  test("adding the same id twice adds one chore", () => {
    const op = {
      type: "add" as const,
      id: "t",
      name: "x",
      intervalDays: 1,
      householdId: null,
    }
    expect(applyChoreOp([towels], op)).toEqual([towels])
  })

  test("checking sets the day, undoing clears it", () => {
    const checked = applyChoreOp([towels], {
      type: "update",
      choreId: "t",
      change: { lastDoneOn: "2026-11-21" },
    })
    expect(checked[0]?.lastDoneOn).toBe("2026-11-21")
    const undone = applyChoreOp(checked, {
      type: "update",
      choreId: "t",
      change: { lastDoneOn: null },
    })
    expect(undone[0]?.lastDoneOn).toBeNull()
  })

  test("an update only changes the fields it names", () => {
    const [chore] = applyChoreOps(
      [{ ...towels, lastDoneOn: "2026-11-21" }],
      [{ type: "update", choreId: "t", change: { name: "Towels", intervalDays: 5 } }]
    )
    expect(chore).toMatchObject({
      name: "Towels",
      intervalDays: 5,
      lastDoneOn: "2026-11-21",
    })
  })

  test("removes a chore and never changes its input", () => {
    const input = [towels]
    expect(applyChoreOp(input, { type: "remove", choreId: "t" })).toEqual([])
    expect(input).toEqual([towels])
  })
})

describe("choreComesBack", () => {
  const done = { intervalDays: 3, lastDoneOn: "2026-11-21" }
  test("says tomorrow for the last day, then counts days", () => {
    expect(choreComesBack(done, "2026-11-21")).toEqual({ key: "inDays", count: 3 })
    expect(choreComesBack(done, "2026-11-22")).toEqual({ key: "inDays", count: 2 })
    expect(choreComesBack(done, "2026-11-23")).toEqual({ key: "tomorrow" })
  })
})

describe("msUntilNextDay", () => {
  test("is the time left until 00:00", () => {
    expect(msUntilNextDay(new Date(2026, 10, 21, 23, 59, 0))).toBe(60_000)
    expect(msUntilNextDay(new Date(2026, 10, 21, 14, 0, 0))).toBe(10 * 3_600_000)
  })
})
