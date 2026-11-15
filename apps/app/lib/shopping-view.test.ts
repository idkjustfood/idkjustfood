import { describe, expect, test } from "bun:test"

import { getSupermarket } from "@workspace/schemas"

import {
  itemsInView,
  sortingFor,
  storeCounts,
  storeIdOf,
  validView,
} from "./shopping-view"

const items = [
  { id: "1", supermarket: null },
  { id: "2", supermarket: "aldi-sued" },
  { id: "3", supermarket: "lidl" },
  { id: "4", supermarket: "aldi-sued" },
]

describe("itemsInView", () => {
  test("all shows everything, in order", () => {
    expect(itemsInView(items, { kind: "all" }).map((i) => i.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ])
  })

  test("default shows only items that were not moved", () => {
    expect(itemsInView(items, { kind: "default" }).map((i) => i.id)).toEqual([
      "1",
    ])
  })

  test("a supermarket shows only its items", () => {
    expect(
      itemsInView(items, { kind: "store", id: "aldi-sued" }).map((i) => i.id)
    ).toEqual(["2", "4"])
  })

  test("nothing is lost or shown twice across default and the supermarkets", () => {
    const ids = [
      ...itemsInView(items, { kind: "default" }),
      ...[...storeCounts(items).keys()].flatMap((id) =>
        itemsInView(items, { kind: "store", id })
      ),
    ].map((i) => i.id)
    expect(ids.sort()).toEqual(["1", "2", "3", "4"])
  })
})

describe("storeIdOf", () => {
  test("is null for the default list", () => {
    expect(storeIdOf({ supermarket: null })).toBeNull()
  })

  test("is the id of the supermarket", () => {
    expect(storeIdOf({ supermarket: "lidl" })).toBe("lidl")
  })
})

describe("storeCounts", () => {
  test("counts items per supermarket and leaves out the default list", () => {
    expect(Object.fromEntries(storeCounts(items))).toEqual({
      "aldi-sued": 2,
      lidl: 1,
    })
  })
})

describe("sortingFor", () => {
  const chosen = getSupermarket("lidl")

  test("a supermarket's view uses its own route", () => {
    expect(sortingFor({ kind: "store", id: "aldi-sued" }, chosen).id).toBe(
      "aldi-sued"
    )
  })

  test("the other views use the saved choice", () => {
    expect(sortingFor({ kind: "all" }, chosen)).toBe(chosen)
    expect(sortingFor({ kind: "default" }, chosen)).toBe(chosen)
  })
})

describe("validView", () => {
  test("falls back to all items when the supermarket has no items left", () => {
    expect(validView({ kind: "store", id: "rewe" }, items)).toEqual({
      kind: "all",
    })
  })

  test("keeps a view that still has items", () => {
    const view = { kind: "store", id: "lidl" } as const
    expect(validView(view, items)).toEqual(view)
    expect(validView({ kind: "default" }, items)).toEqual({ kind: "default" })
  })
})
