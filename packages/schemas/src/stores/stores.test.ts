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
  test("ids and aliases are unique and the default exists", () => {
    const ids = supermarkets.flatMap((s) => [s.id, ...(s.aliases ?? [])])
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

  test("every supermarket says where its route comes from", () => {
    for (const s of supermarkets)
      expect(s.source.trim().length).toBeGreaterThan(10)
  })

  test("the standard one is first, the others are sorted by name", () => {
    expect(supermarkets[0]?.id).toBe(defaultSupermarketId)
    const names = supermarkets.slice(1).map((s) => s.name ?? s.id)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "de")))
  })

  test("every chain of ticket #68 can be found", () => {
    for (const name of [
      "Aldi Süd",
      "Aldi Nord",
      "Lidl",
      "Rewe",
      "Edeka",
      "Kaufland",
      "Penny",
      "Norma",
      "Globus",
      "tegut",
      "Alnatura",
      "Metro",
      "Selgros",
    ])
      expect(supermarkets.map((s) => s.name)).toContain(name)
  })

  test("a choice saved before the Aldi split still works", () => {
    expect(getSupermarket("aldi").id).toBe("aldi-sued")
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
    expect(sections("standard")).toEqual([
      "produce",
      "bakery",
      "dairy",
      "other",
    ])
    expect(sections("aldi")).toEqual(["bakery", "produce", "dairy", "other"])
  })

  test("loses and duplicates nothing", () => {
    const groups = sortByRoute(items, getSupermarket("aldi"))
    expect(
      groups
        .flatMap((g) => g.items)
        .sort((a, b) => a.name.localeCompare(b.name))
    ).toEqual([...items].sort((a, b) => a.name.localeCompare(b.name)))
  })

  test("a section missing from the route is still shown, before other", () => {
    const groups = sortByRoute(items, {
      id: "x",
      source: "test",
      route: ["dairy"],
    })
    expect(groups.map((g) => g.section)).toEqual([
      "dairy",
      "bakery",
      "produce",
      "other",
    ])
  })
})
