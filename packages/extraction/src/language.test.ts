import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { recipeLanguageNames, recipeLanguages } from "@workspace/schemas"

import { languageRule, parseRecipeSystem } from "./ai/prompts.js"
import { ExtractionError } from "./errors.js"
import { pageLanguage } from "./inputs/schema-org.js"
import { extractRecipe } from "./pipeline.js"
import { fakeAi, fakeMedia, noAi, pancakeJson } from "./testing.js"

let tempRoot: string
beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "language-test-"))
})
afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true })
})

const reel = {
  type: "link",
  url: "https://www.instagram.com/reel/Cabc123/",
} as const

const pageRecipe = {
  "@type": "Recipe",
  name: "Pasta with garlic",
  description: "A quick dinner.",
  recipeYield: "2",
  recipeIngredient: ["400 g spaghetti", "salt, to taste"],
  recipeInstructions: [{ "@type": "HowToStep", text: "Boil the pasta." }],
}
const page = (lang?: string) =>
  `<html${lang ? ` lang="${lang}"` : ""}><head><script type="application/ld+json">${JSON.stringify(pageRecipe)}</script></head></html>`
const site = { type: "link", url: "http://93.184.216.34/pasta" } as const
const fetchPage = (html: string) => async (url: string) => ({ url, html })

describe("the language rule in the prompt", () => {
  test("keeps the language of the material when no language is set", () => {
    expect(parseRecipeSystem()).toContain("language of the material")
    expect(languageRule()).not.toContain("translate")
  })

  test("names each supported language and says to translate", () => {
    for (const code of recipeLanguages) {
      const prompt = parseRecipeSystem(code)
      expect(prompt).toContain(`in ${recipeLanguageNames[code]}`)
      expect(prompt).toContain("translate it")
      // Units and tags are fixed keys: the rest of the prompt still lists them.
      expect(prompt).toContain("never translate them")
      expect(prompt).toContain("choose ONLY from the list")
    }
  })
})

describe("pageLanguage", () => {
  test("reads the lang of the html tag", () => {
    expect(pageLanguage('<!doctype html><html lang="de-AT" class="x">')).toBe(
      "de"
    )
    expect(pageLanguage("<HTML dir=ltr LANG=fr>")).toBe("fr")
    expect(pageLanguage("<html><body lang='it'>")).toBeUndefined()
  })
})

describe("recipes in the selected language", () => {
  test("a video recipe is parsed in the selected language", async () => {
    for (const language of recipeLanguages) {
      const ai = fakeAi()
      await extractRecipe(reel, {
        ai,
        media: fakeMedia(),
        tempRoot,
        language,
      })
      expect(ai.calls.languages).toEqual([language])
    }
  })

  test("without a language the AI is not asked to translate", async () => {
    const ai = fakeAi()
    await extractRecipe(reel, { ai, media: fakeMedia(), tempRoot })
    expect(ai.calls.languages).toEqual([undefined])
  })

  test("photos and text are parsed in the selected language too", async () => {
    const ai = fakeAi()
    await extractRecipe(
      { type: "text", text: "Pancakes: 200 g flour" },
      { ai, tempRoot, language: "de" }
    )
    await extractRecipe(
      {
        type: "image",
        data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0x0d]),
        mediaType: "image/png",
      },
      { ai, tempRoot, language: "fr" }
    )
    expect(ai.calls.languages).toEqual(["de", "fr"])
  })

  test("a web recipe in another language is translated, but numbers and units stay", async () => {
    const ai = fakeAi({
      async parseRecipe(material) {
        expect(material).toContain("spaghetti")
        // The AI tries to change an amount and to invent a note: both are ignored.
        return {
          title: "Pasta mit Knoblauch",
          description: "Ein schnelles Abendessen.",
          servings: 9,
          tags: ["vegan"],
          ingredients: [
            { name: "Spaghetti", quantity: 500, unit: "kg", note: "frisch" },
            { name: "Salz", quantity: 3, unit: "g", note: "nach Geschmack" },
          ],
          steps: [{ text: "Die Nudeln kochen." }],
        }
      },
    })
    const recipe = await extractRecipe(site, {
      ai,
      language: "de",
      tempRoot,
      fetchPage: fetchPage(page("en")),
    })
    expect(recipe.title).toBe("Pasta mit Knoblauch")
    expect(recipe.description).toBe("Ein schnelles Abendessen.")
    expect(recipe.steps[0]!.text).toBe("Die Nudeln kochen.")
    expect(recipe.servings).toBe(2)
    expect(recipe.tags).toEqual([])
    expect(recipe.ingredients[0]).toMatchObject({
      name: "Spaghetti",
      quantity: 400,
      unit: "g",
      note: null,
    })
    // The page said "salt" without an amount: it stays empty.
    expect(recipe.ingredients[1]).toMatchObject({
      name: "Salz",
      quantity: null,
      unit: null,
    })
  })

  test("a web recipe that is already in the selected language is not changed", async () => {
    const recipe = await extractRecipe(site, {
      ai: noAi,
      language: "de",
      tempRoot,
      fetchPage: fetchPage(page("de-DE")),
    })
    expect(recipe.title).toBe("Pasta with garlic")
  })

  test("a web recipe whose language is unknown is handed to the AI", async () => {
    const ai = fakeAi()
    await extractRecipe(site, {
      ai,
      language: "de",
      tempRoot,
      fetchPage: fetchPage(page()),
    }).catch(() => undefined)
    expect(ai.calls.languages).toEqual(["de"])
  })

  test("a web recipe stays as it is without a language or without an AI key", async () => {
    const options = { tempRoot, fetchPage: fetchPage(page("en")) }
    expect((await extractRecipe(site, { ai: noAi, ...options })).title).toBe(
      "Pasta with garlic"
    )
    const unconfigured = fakeAi({
      async parseRecipe() {
        throw new ExtractionError("ai_not_configured", "No AI key")
      },
    })
    const recipe = await extractRecipe(site, {
      ai: unconfigured,
      language: "de",
      ...options,
    })
    expect(recipe.title).toBe("Pasta with garlic")
  })

  test("a translation that loses an ingredient is refused", async () => {
    const ai = fakeAi({
      parseRecipe: async () => ({
        ...pancakeJson,
        ingredients: [{ name: "Spaghetti", quantity: null, unit: null }],
        steps: [{ text: "Kochen." }],
      }),
    })
    await expect(
      extractRecipe(site, {
        ai,
        language: "de",
        tempRoot,
        fetchPage: fetchPage(page("en")),
      })
    ).rejects.toMatchObject({ code: "invalid_recipe" })
  })
})
