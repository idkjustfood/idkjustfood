import { describe, expect, test } from "bun:test"

import { inSpace, resolveSpace } from "./space"

const items = [
  { id: "a", householdId: null },
  { id: "b", householdId: "flat" },
  { id: "c", householdId: "family" },
  { id: "d", householdId: "flat" },
]

describe("inSpace", () => {
  test("keeps only personal items in the personal space", () => {
    expect(inSpace(items, null).map((i) => i.id)).toEqual(["a"])
  })

  test("keeps only the items of the selected household", () => {
    expect(inSpace(items, "flat").map((i) => i.id)).toEqual(["b", "d"])
    expect(inSpace(items, "family").map((i) => i.id)).toEqual(["c"])
  })

  test("shows nothing for a household without items", () => {
    expect(inSpace(items, "other")).toEqual([])
  })
})

describe("resolveSpace", () => {
  const households = [{ id: "flat" }, { id: "family" }]

  test("keeps a household the user is still in", () => {
    expect(resolveSpace("family", households)).toBe("family")
  })

  test("falls back to personal when the household is gone", () => {
    expect(resolveSpace("old", households)).toBeNull()
    expect(resolveSpace("flat", [])).toBeNull()
  })

  test("stays personal", () => {
    expect(resolveSpace(null, households)).toBeNull()
  })
})
