import { describe, expect, test } from "bun:test"

import {
  classifySection,
  defaultSupermarketId,
  getSupermarket,
  sortByRoute,
  storeSections,
  supermarkets,
} from "./index.js"

describe("classifySection", () => {
  test.each([
    ["Tomaten", "produce"],
    ["Rinderhack", "meat"],
    ["Milch", "dairy"],
    ["Tomatenmark", "canned"],
    ["Mehl", "dryGoods"],
    ["Tiefkühlerbsen", "frozen"],
    ["Brötchen", "bakery"],
    ["flour", "dryGoods"],
    ["Zucchini", "produce"],
    ["Champignons", "produce"],
    ["Schinken", "meat"],
    ["something unknown", "other"],
  ])("%s is %s", (name, section) => {
    expect(classifySection(name)).toBe(section as never)
  })
})

describe("supermarkets", () => {
  test("ids are unique and the default exists", () => {
    const ids = supermarkets.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(defaultSupermarketId)
  })

  test("a route lists each section at most once and never 'other'", () => {
    for (const s of supermarkets) {
      expect(new Set(s.route).size).toBe(s.route.length)
      expect(s.route).not.toContain("other")
      for (const section of s.route) expect(storeSections).toContain(section)
    }
  })

  test("an unknown id falls back to the standard one", () => {
    expect(getSupermarket("nope").id).toBe(defaultSupermarketId)
    expect(getSupermarket(null).id).toBe(defaultSupermarketId)
  })
})

describe("sortByRoute", () => {
  const items = [
    { name: "Milch" },
    { name: "Brot" },
    { name: "Äpfel" },
    { name: "Dingsbums" },
  ]

  test("follows the route of the supermarket and puts other last", () => {
    const sections = (id: string) =>
      sortByRoute(items, getSupermarket(id)).map((g) => g.section)
    expect(sections("standard")).toEqual(["produce", "bakery", "dairy", "other"])
    expect(sections("aldi")).toEqual(["bakery", "produce", "dairy", "other"])
  })

  test("loses and duplicates nothing", () => {
    const groups = sortByRoute(items, getSupermarket("aldi"))
    expect(groups.flatMap((g) => g.items).sort((a, b) => a.name.localeCompare(b.name))).toEqual(
      [...items].sort((a, b) => a.name.localeCompare(b.name))
    )
  })

  test("a section missing from the route is still shown, before other", () => {
    const groups = sortByRoute(items, { id: "x", route: ["dairy"] })
    expect(groups.map((g) => g.section)).toEqual(["dairy", "bakery", "produce", "other"])
  })
})
