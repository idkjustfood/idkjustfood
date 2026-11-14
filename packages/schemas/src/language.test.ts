import { describe, expect, test } from "bun:test"

import {
  RecipeLanguageSchema,
  recipeLanguageNames,
  recipeLanguages,
  toRecipeLanguage,
} from "./language.js"

describe("recipe languages", () => {
  test("are the five app languages", () => {
    expect([...recipeLanguages].sort()).toEqual(["de", "en", "es", "fr", "it"])
    for (const code of recipeLanguages) {
      expect(recipeLanguageNames[code].length).toBeGreaterThan(1)
    }
  })

  test("the schema accepts only supported codes", () => {
    expect(RecipeLanguageSchema.safeParse("de").success).toBe(true)
    expect(RecipeLanguageSchema.safeParse("nl").success).toBe(false)
  })

  test("toRecipeLanguage reads regional and upper-case codes", () => {
    expect(toRecipeLanguage("de-AT")).toBe("de")
    expect(toRecipeLanguage("FR_ca")).toBe("fr")
    expect(toRecipeLanguage(" it ")).toBe("it")
    expect(toRecipeLanguage("nl")).toBeUndefined()
    expect(toRecipeLanguage("")).toBeUndefined()
    expect(toRecipeLanguage(undefined)).toBeUndefined()
  })
})
