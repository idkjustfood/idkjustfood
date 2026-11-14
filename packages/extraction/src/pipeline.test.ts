import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { createLogger } from "@workspace/logger"

import { ExtractionError } from "./errors.js"
import { parseRecipeSystem } from "./ai/prompts.js"
import { extractRecipe } from "./pipeline.js"
import { fakeAi, fakeMedia, filesIn, pancakeJson, tinyPng } from "./testing.js"

let tempRoot: string
beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "pipeline-test-"))
})
afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true })
})

const reel = {
  type: "link",
  url: "https://www.instagram.com/reel/Cabc123/",
} as const

describe("video links", () => {
  test("combines caption, speech and on-screen text into one recipe", async () => {
    const ai = fakeAi()
    const recipe = await extractRecipe(reel, {
      ai,
      media: fakeMedia(),
      tempRoot,
    })

    expect(recipe.title).toBe("Pancakes")
    expect(recipe.source).toEqual({
      kind: "video",
      label: "Instagram reel · @chef",
      url: "https://www.instagram.com/reel/Cabc123/",
    })
    const material = ai.calls.parseRecipe[0]!
    expect(material).toContain("Easy pancakes!")
    expect(material).toContain("Two hundred grams of flour.")
    expect(material).toContain("200 g flour")
    expect(ai.calls.readImages[0]).toHaveLength(1)
  })

  test("a video without sound skips the transcription", async () => {
    const ai = fakeAi()
    await extractRecipe(reel, {
      ai,
      media: fakeMedia({ audio: false }),
      tempRoot,
    })
    expect(ai.calls.transcribe).toBe(0)
  })

  test("leaves no video, audio or frame files behind", async () => {
    const media = fakeMedia()
    await extractRecipe(reel, { ai: fakeAi(), media, tempRoot })
    expect(media.dirs).toHaveLength(1)
    expect(await filesIn(media.dirs[0]!)).toEqual([])
    expect(await filesIn(tempRoot)).toEqual([])
  })

  test("cleans up also when the job fails", async () => {
    const media = fakeMedia()
    const ai = fakeAi({
      parseRecipe: async () => {
        throw new ExtractionError("ai_failed", "boom")
      },
    })
    await expect(extractRecipe(reel, { ai, media, tempRoot })).rejects.toThrow(
      "boom"
    )
    expect(await filesIn(tempRoot)).toEqual([])
  })

  test("a private video gives a clear error", async () => {
    const media = {
      ...fakeMedia(),
      download: async () => {
        throw new ExtractionError(
          "video_unavailable",
          "That video is private or needs a login."
        )
      },
    }
    await expect(
      extractRecipe(reel, { ai: fakeAi(), media, tempRoot })
    ).rejects.toMatchObject({
      code: "video_unavailable",
    })
    expect(await filesIn(tempRoot)).toEqual([])
  })

  test("a model that cannot read images fails with a message, no guessing", async () => {
    const ai = fakeAi({
      readImages: async () => {
        throw new ExtractionError(
          "model_cannot_read_images",
          'The model "x" can\'t read images.'
        )
      },
    })
    await expect(
      extractRecipe(reel, { ai, media: fakeMedia(), tempRoot })
    ).rejects.toMatchObject({
      code: "model_cannot_read_images",
    })
  })
})

describe("photos", () => {
  test("reads the picture and parses its text", async () => {
    const ai = fakeAi()
    const recipe = await extractRecipe(
      { type: "image", data: tinyPng, mediaType: "image/png" },
      { ai, tempRoot }
    )
    expect(recipe.source.kind).toBe("photo")
    expect(ai.calls.transcribe).toBe(0)
    expect(ai.calls.readImages[0]![0]!.mediaType).toBe("image/png")
    expect(ai.calls.parseRecipe[0]).toContain("Text read from the photo")
  })

  test("a file that is not an image is refused", async () => {
    await expect(
      extractRecipe(
        {
          type: "image",
          data: new TextEncoder().encode("hello, not a picture"),
          mediaType: "image/png",
        },
        { ai: fakeAi(), tempRoot }
      )
    ).rejects.toMatchObject({ code: "invalid_input" })
  })

  test("a huge image is refused", async () => {
    const big = new Uint8Array(11 * 1024 * 1024)
    big.set(tinyPng)
    await expect(
      extractRecipe(
        { type: "image", data: big, mediaType: "image/png" },
        { ai: fakeAi(), tempRoot }
      )
    ).rejects.toThrow(/too large/)
  })
})

describe("pasted text", () => {
  test("is parsed without reading images or audio", async () => {
    const ai = fakeAi()
    const recipe = await extractRecipe(
      { type: "text", text: "Pancakes\n200 g flour\n300 ml milk\nsalt" },
      { ai, tempRoot }
    )
    expect(recipe.source).toEqual({ kind: "text", label: null, url: null })
    expect(ai.calls.readImages).toHaveLength(0)
    expect(ai.calls.transcribe).toBe(0)
    expect(ai.calls.parseRecipe[0]).toContain("200 g flour")
  })

  test("empty text is refused", async () => {
    await expect(
      extractRecipe({ type: "text", text: "   " }, { ai: fakeAi(), tempRoot })
    ).rejects.toMatchObject({ code: "invalid_input" })
  })
})

describe("the recipe", () => {
  const text = { type: "text", text: "Pancakes" } as const
  const withAnswer = (answer: unknown) =>
    fakeAi({ parseRecipe: async () => answer })

  test("an ingredient without an amount keeps an empty quantity", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer(pancakeJson),
      tempRoot,
    })
    const salt = recipe.ingredients.find((i) => i.name === "salt")!
    expect(salt.quantity).toBeNull()
    expect(salt.unit).toBeNull()
  })

  test("tags, times and nutrition come out in the shared recipe shape", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer(pancakeJson),
      tempRoot,
    })
    expect(recipe.tags).toEqual(["vegetarian", "under_30_min", "breakfast"])
    expect(recipe.cookMinutes).toBe(15)
    expect(recipe.nutrition).toEqual({
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    })
  })

  test("tags outside the list are dropped instead of failing the job", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer({
        ...pancakeJson,
        tags: [
          "Pasta",
          "x".repeat(60),
          "tasty",
          "Italienisch",
          "italian",
          5,
          "",
        ],
      }),
      tempRoot,
    })
    // Known spellings become the key, repeats go, the rest is in the list's order.
    expect(recipe.tags).toEqual(["italian", "pasta"])
  })

  test("servings the source does not state become 1, not a guess", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer({ ...pancakeJson, servings: null }),
      tempRoot,
    })
    expect(recipe.servings).toBe(1)
  })

  test("an answer that does not fit the schema fails with a readable message", async () => {
    const bad = {
      ...pancakeJson,
      ingredients: [
        { name: "flour", quantity: "a lot", unit: "g", note: null },
      ],
    }
    const failure = await extractRecipe(text, {
      ai: withAnswer(bad),
      tempRoot,
    }).catch((e) => e)
    expect(failure).toBeInstanceOf(ExtractionError)
    expect(failure.code).toBe("invalid_recipe")
    expect(failure.message).toContain("ingredients.0.quantity")
  })

  test("units the AI wrote in its own words are mapped to the list", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer({
        ...pancakeJson,
        ingredients: [
          { name: "Mehl", quantity: 2, unit: "Esslöffel", note: null },
          { name: "Milch", quantity: 250, unit: "Gramm", note: null },
          { name: "basil", quantity: 1, unit: "handful", note: "torn" },
        ],
      }),
      tempRoot,
    })
    expect(recipe.ingredients).toEqual([
      { name: "Mehl", quantity: 2, unit: "tbsp", note: null },
      { name: "Milch", quantity: 250, unit: "g", note: null },
      // Not in the list: the amount stays, the original word goes into the note.
      { name: "basil", quantity: 1, unit: null, note: "handful, torn" },
    ])
  })

  test("parts of the recipe become sections, kept together in order", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer({
        ...pancakeJson,
        ingredients: [
          { name: "tomato", quantity: 3, unit: null, note: null, section: "Sauce" },
          { name: "flour", quantity: 200, unit: "g", note: null, section: "Dough" },
          { name: "basil", quantity: null, unit: null, note: null, section: "Sauce" },
        ],
        steps: [
          { text: "Simmer.", section: "Sauce" },
          { text: "Knead.", section: "Dough" },
          { text: "Serve.", section: null },
        ],
      }),
      tempRoot,
    })
    expect(recipe.ingredients.map((i) => [i.name, i.section])).toEqual([
      ["tomato", "Sauce"],
      ["basil", "Sauce"],
      ["flour", "Dough"],
    ])
    expect(recipe.steps.map((s) => [s.text, s.section])).toEqual([
      ["Simmer.", "Sauce"],
      ["Knead.", "Dough"],
      ["Serve.", null],
    ])
  })

  test("a recipe without parts gets no sections", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer(pancakeJson),
      tempRoot,
    })
    expect(recipe.ingredients.every((i) => i.section === undefined)).toBe(true)
    expect(recipe.steps.every((s) => s.section === undefined)).toBe(true)
  })

  test("a recipe with only one part gets no sections", async () => {
    const recipe = await extractRecipe(text, {
      ai: withAnswer({
        ...pancakeJson,
        ingredients: [
          { name: "flour", quantity: 200, unit: "g", note: null, section: "Dough" },
        ],
        steps: [{ text: "Knead.", section: "Dough" }],
      }),
      tempRoot,
    })
    expect(recipe.ingredients[0]).not.toHaveProperty("section")
    expect(recipe.steps[0]).not.toHaveProperty("section")
  })

  test("a negative or zero amount is not accepted", async () => {
    const bad = {
      ...pancakeJson,
      ingredients: [{ name: "flour", quantity: 0, unit: "g", note: null }],
    }
    await expect(
      extractRecipe(text, { ai: withAnswer(bad), tempRoot })
    ).rejects.toMatchObject({
      code: "invalid_recipe",
    })
  })

  test("the AI saying there is no recipe becomes a clear error", async () => {
    await expect(
      extractRecipe(text, {
        ai: withAnswer({ error: "no recipe found" }),
        tempRoot,
      })
    ).rejects.toMatchObject({ code: "no_recipe_found" })
  })

  test("a recipe with no ingredients and no steps is not a recipe", async () => {
    await expect(
      extractRecipe(text, {
        ai: withAnswer({ ...pancakeJson, ingredients: [], steps: [] }),
        tempRoot,
      })
    ).rejects.toMatchObject({ code: "no_recipe_found" })
  })
})

describe("the AI prompt for tags", () => {
  test("lists every tag of the list and says to choose only from it", async () => {
    const { parseRecipeSystem } = await import("./ai/prompts.js")
    const { tagKeys } = await import("@workspace/schemas")
    for (const tag of tagKeys) expect(parseRecipeSystem()).toContain(tag)
    expect(parseRecipeSystem()).toMatch(/choose ONLY from the list/)
  })
})

describe("logging", () => {
  function capture() {
    const lines: string[] = []
    const logger = createLogger({
      level: "debug",
      write: (line) => lines.push(line),
    })
    return { logger, entries: () => lines.map((l) => JSON.parse(l)), lines }
  }

  test("logs each step of a video with the source and the AI provider", async () => {
    const { logger, entries } = capture()
    const ai = fakeAi({
      describe: (job) => ({ provider: "openrouter", model: `${job}-model` }),
    })
    await extractRecipe(reel, {
      ai,
      media: fakeMedia(),
      tempRoot,
      logger: logger.child({ jobId: "j1" }),
    })

    const done = entries().filter((e) => e.msg === "step done")
    expect(done.map((e) => e.step)).toEqual([
      "gather",
      "transcription",
      "vision",
      "parsing",
    ])
    expect(done.every((e) => e.jobId === "j1")).toBe(true)
    expect(done.every((e) => typeof e.durationMs === "number")).toBe(true)
    expect(done[0].source).toBe("instagram")
    expect(done[1]).toMatchObject({
      provider: "openrouter",
      model: "transcription-model",
    })
  })

  test("a failing step is logged with its name and the reason", async () => {
    const { logger, entries } = capture()
    const ai = fakeAi({
      parseRecipe: async () => {
        throw new ExtractionError("ai_failed", "The model did not answer")
      },
    })
    await expect(
      extractRecipe(reel, { ai, media: fakeMedia(), tempRoot, logger })
    ).rejects.toThrow()
    const failed = entries().find((e) => e.msg === "step failed")
    expect(failed).toMatchObject({
      level: "warn",
      step: "parsing",
      code: "ai_failed",
      reason: "The model did not answer",
    })
  })

  test("an unexpected crash is logged as an error with its stack", async () => {
    const { logger, entries } = capture()
    const ai = fakeAi({
      parseRecipe: async () => {
        throw new TypeError("cannot read x")
      },
    })
    await expect(
      extractRecipe(reel, { ai, media: fakeMedia(), tempRoot, logger })
    ).rejects.toThrow()
    const failed = entries().find((e) => e.msg === "step failed")
    expect(failed.level).toBe("error")
    expect(failed.step).toBe("parsing")
    expect(failed.err.stack).toContain("cannot read x")
  })

  test("never writes the caption, the speech or the recipe text", async () => {
    const { logger, lines } = capture()
    await extractRecipe(reel, {
      ai: fakeAi(),
      media: fakeMedia(),
      tempRoot,
      logger,
    })
    const text = lines.join("\n")
    expect(text).not.toContain("Easy pancakes!")
    expect(text).not.toContain("Two hundred grams of flour")
    expect(text).not.toContain("Fry for 2 minutes")
  })
})

describe("nutrition estimate", () => {
  const text = { type: "text", text: "Pancakes" } as const
  const estimate = { calories: 320, protein: 9, carbs: 41.5, fat: null }
  const withEstimate = (nutrition: unknown) =>
    fakeAi({ parseRecipe: async () => ({ ...pancakeJson, nutrition }) })
  const run = (ai: ReturnType<typeof fakeAi>, input = reel) =>
    extractRecipe(input, { ai, media: fakeMedia(), tempRoot })

  test("a video gets the AI's estimate, marked as an estimate", async () => {
    const ai = withEstimate(estimate)
    const recipe = await run(ai)
    expect(recipe.nutrition).toEqual({ ...estimate, estimated: true })
  })

  test("only video parsing asks the AI for an estimate", async () => {
    const asked: (boolean | undefined)[] = []
    const ai = fakeAi({
      parseRecipe: async (_material, options) => {
        asked.push(options?.estimateNutrition)
        return { ...pancakeJson, nutrition: estimate }
      },
    })
    const fromVideo = await run(ai)
    const fromText = await extractRecipe(text, { ai, tempRoot })
    expect(asked).toEqual([true, false])
    expect(fromVideo.nutrition.estimated).toBe(true)
    // Not asked for, so an answer with values anyway is not kept.
    expect(fromText.nutrition).toEqual({
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    })
  })

  test("without an estimate the values stay empty and nothing breaks", async () => {
    const empty = {
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    }
    for (const answer of [undefined, null, "unknown", empty]) {
      const recipe = await run(withEstimate(answer))
      expect(recipe.nutrition).toEqual(empty)
    }
  })

  test("a value that is not a usable number stays empty, the rest is kept", async () => {
    const recipe = await run(
      withEstimate({ calories: "lots", protein: -4, carbs: 30, fat: 12 })
    )
    expect(recipe.nutrition).toEqual({
      calories: null,
      protein: null,
      carbs: 30,
      fat: 12,
      estimated: true,
    })
  })

  test("the prompt asks for nutrition only when an estimate is wanted", () => {
    expect(parseRecipeSystem("en", true)).toContain('"nutrition"')
    expect(parseRecipeSystem("en")).not.toContain('"nutrition"')
  })
})
