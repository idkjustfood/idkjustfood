import { describe, expect, test } from "bun:test"

import { parseImport, toMarkdown, toSchemaOrg } from "./formats.js"
import { RecipeContentSchema } from "./recipe.js"
import {
  fitTag,
  fitTags,
  groupTags,
  isTagKey,
  sortTags,
  tagGroup,
  tagGroupKeys,
  tagKeys,
  tagSpellings,
  tagsByGroup,
  TagsSchema,
} from "./tags.js"

describe("the list of tags", () => {
  test("has six groups in order, each with tags, and no tag twice", () => {
    expect(tagGroupKeys).toEqual([
      "cuisine",
      "dish",
      "diet",
      "nutrition",
      "time",
      "meal",
    ])
    expect(new Set(tagKeys).size).toBe(tagKeys.length)
    for (const group of tagGroupKeys) {
      expect(tagsByGroup[group].length).toBeGreaterThan(0)
    }
    expect(tagsByGroup.meal).toEqual(["breakfast", "midday", "afternoon"])
    expect(tagGroup("vegan")).toBe("diet")
  })

  test("only accepts keys from the list, each once", () => {
    expect(isTagKey("italian")).toBe(true)
    expect(isTagKey("Italian")).toBe(false)
    expect(isTagKey("italienisch")).toBe(false)
    expect(TagsSchema.safeParse(["italian", "vegan"]).success).toBe(true)
    expect(TagsSchema.safeParse(["italian", "tasty"]).success).toBe(false)
    expect(TagsSchema.safeParse(["italian", "italian"]).success).toBe(false)
    expect(TagsSchema.safeParse(["Italian"]).success).toBe(false)
  })

  test("a recipe cannot have a tag that is not in the list", () => {
    const base = {
      title: "Soup",
      description: "",
      servings: 2,
      prepMinutes: null,
      cookMinutes: null,
      ingredients: [],
      steps: [],
      nutrition: { calories: null, protein: null, carbs: null, fat: null },
      source: { kind: "manual", label: null, url: null },
    }
    expect(
      RecipeContentSchema.safeParse({ ...base, tags: ["soup"] }).success
    ).toBe(true)
    expect(
      RecipeContentSchema.safeParse({ ...base, tags: ["Soup!"] }).success
    ).toBe(false)
  })

  test("sorts and groups tags in the fixed order", () => {
    expect(sortTags(["breakfast", "vegan", "pasta", "italian"])).toEqual([
      "italian",
      "pasta",
      "vegan",
      "breakfast",
    ])
    expect(groupTags(["breakfast", "italian", "pasta", "indian"])).toEqual([
      { group: "cuisine", tags: ["italian", "indian"] },
      { group: "dish", tags: ["pasta"] },
      { group: "meal", tags: ["breakfast"] },
    ])
  })
})

describe("fitting outside tags to the list", () => {
  test("maps spellings in every app language to the key", () => {
    expect(fitTag("Italian")).toBe("italian")
    expect(fitTag("italienisch")).toBe("italian")
    expect(fitTag("Italy")).toBe("italian")
    expect(fitTag("Gluten-free")).toBe("gluten_free")
    expect(fitTag("sans gluten")).toBe("gluten_free")
    expect(fitTag("Under 30 min")).toBe("under_30_min")
    expect(fitTag("Under 1 hour")).toBe("under_60_min")
    expect(fitTag("Lunch")).toBe("midday")
    expect(fitTag("Dinner")).toBe("afternoon")
    expect(fitTag("Frühstück")).toBe("breakfast")
    expect(fitTag("  HIGH-PROTEIN ")).toBe("high_protein")
  })

  test("drops what is not on the list and anything that is not text", () => {
    expect(fitTag("tasty")).toBeNull()
    expect(fitTag("Over 1 hour")).toBeNull()
    expect(fitTag(4)).toBeNull()
    expect(fitTags(["tasty", "Vegan", "vegan", "Italian", 3, null])).toEqual([
      "italian",
      "vegan",
    ])
    expect(fitTags("Vegan, Soup, whatever")).toEqual(["soup", "vegan"])
    expect(fitTags(undefined)).toEqual([])
  })

  test("every spelling points at a tag of the list, and every tag is known by its key", () => {
    for (const [, key] of tagSpellings) expect(isTagKey(key)).toBe(true)
    for (const key of tagKeys) expect(fitTag(key)).toBe(key)
  })
})

describe("tags in files", () => {
  const recipe = {
    title: "Dal",
    description: "",
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    tags: ["indian", "vegan", "under_30_min"] as never,
    ingredients: [],
    steps: [],
    nutrition: { calories: null, protein: null, carbs: null, fat: null },
    source: { kind: "manual" as const, label: null, url: null },
  }

  test("Markdown and schema.org show English names, and schema.org reads back", () => {
    expect(toMarkdown(recipe)).toContain("**Tags:** Indian, Vegan, Under 30 min")
    const ld = toSchemaOrg(recipe)
    expect(ld.keywords).toBe("Indian, Vegan, Under 30 min")
    const back = parseImport(JSON.stringify(ld))
    expect(back.ok && back.recipe.tags).toEqual([
      "indian",
      "vegan",
      "under_30_min",
    ])
  })

  test("a JSON file with old free-text tags keeps the ones on the list", () => {
    const old = JSON.stringify({
      title: "Dal",
      description: "",
      servings: 2,
      prepMinutes: null,
      cookMinutes: null,
      tags: ["Indian", "Spicy", "vegan"],
      ingredients: [],
      steps: [],
      nutrition: { calories: null, protein: null, carbs: null, fat: null },
    })
    const result = parseImport(old)
    expect(result.ok && result.recipe.tags).toEqual(["indian", "vegan"])
  })
})
