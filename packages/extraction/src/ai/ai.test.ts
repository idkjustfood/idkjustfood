import { describe, expect, test } from "bun:test"

import { extractRecipe } from "../pipeline.js"
import { pancakeJson } from "../testing.js"
import { aiConfigured, createAi, providers } from "./index.js"
import { parseJsonReply } from "./prompts.js"
import type { AiProvider } from "./types.js"

/** A provider that records which model each job was given. */
function recordingProvider(id: string) {
  const seen: {
    id: string
    job: string
    model: string
    apiKey: string
    baseUrl?: string
  }[] = []
  const provider: AiProvider = {
    id,
    defaultModels: {
      transcription: "t-default",
      vision: "v-default",
      parsing: "p-default",
    },
    defaultBaseUrl: `https://${id}.test/v1`,
    transcriber: (o) => ({
      async transcribe() {
        seen.push({ id, job: "transcription", ...o })
        return "spoken"
      },
    }),
    imageReader: (o) => ({
      async readImages() {
        seen.push({ id, job: "vision", ...o })
        return "seen"
      },
    }),
    recipeParser: (o) => ({
      async parseRecipe() {
        seen.push({ id, job: "parsing", ...o })
        return pancakeJson
      },
    }),
  }
  return { provider, seen }
}

const audio = { data: new Uint8Array([1]), mediaType: "audio/mpeg" }
const image = { data: new Uint8Array([1]), mediaType: "image/png" }

describe("settings", () => {
  test("the real registry knows OpenRouter", () => {
    expect(providers.map((p) => p.id)).toContain("openrouter")
  })

  test("without a key nothing is configured and jobs fail with a clear error", async () => {
    expect(aiConfigured({})).toBe(false)
    expect(aiConfigured({ AI_PROVIDER: "openrouter", AI_API_KEY: "  " })).toBe(
      false
    )
    await expect(createAi({}).parseRecipe("x")).rejects.toMatchObject({
      code: "ai_not_configured",
    })
    await expect(createAi({}).transcribe(audio)).rejects.toMatchObject({
      code: "ai_not_configured",
    })
  })

  test("a key makes the AI configured", () => {
    expect(aiConfigured({ AI_PROVIDER: "openrouter", AI_API_KEY: "k" })).toBe(
      true
    )
    expect(aiConfigured({ AI_API_KEY: "k" })).toBe(true) // openrouter is the default
  })

  test("an unknown provider is reported", async () => {
    expect(aiConfigured({ AI_PROVIDER: "nope", AI_API_KEY: "k" })).toBe(false)
    await expect(
      createAi({ AI_PROVIDER: "nope", AI_API_KEY: "k" }).parseRecipe("x")
    ).rejects.toThrow(/not known/)
  })

  test("models come from settings, with defaults, with no code change", async () => {
    const { provider, seen } = recordingProvider("fake")
    const env = { AI_PROVIDER: "fake", AI_API_KEY: "key-1" }

    const defaults = createAi(env, [provider])
    await defaults.transcribe(audio)
    await defaults.readImages([image])
    await defaults.parseRecipe("x")
    expect(seen.map((s) => [s.job, s.model])).toEqual([
      ["transcription", "t-default"],
      ["vision", "v-default"],
      ["parsing", "p-default"],
    ])
    expect(seen[0]).toMatchObject({
      apiKey: "key-1",
      baseUrl: "https://fake.test/v1",
    })

    seen.length = 0
    const changed = createAi(
      {
        ...env,
        AI_TRANSCRIPTION_MODEL: "my-whisper",
        AI_VISION_MODEL: "my-vision",
        AI_PARSING_MODEL: "my-parser",
        AI_BASE_URL: "http://localhost:11434/v1",
      },
      [provider]
    )
    await changed.transcribe(audio)
    await changed.readImages([image])
    await changed.parseRecipe("x")
    expect(seen.map((s) => s.model)).toEqual([
      "my-whisper",
      "my-vision",
      "my-parser",
    ])
    expect(seen.every((s) => s.baseUrl === "http://localhost:11434/v1")).toBe(
      true
    )
  })

  test("each job can use a different provider", async () => {
    const a = recordingProvider("alpha")
    const b = recordingProvider("beta")
    const ai = createAi(
      {
        AI_PROVIDER: "alpha",
        AI_API_KEY: "k",
        AI_PARSING_PROVIDER: "beta",
        AI_PARSING_API_KEY: "k2",
      },
      [a.provider, b.provider]
    )
    await ai.transcribe(audio)
    await ai.parseRecipe("x")
    expect(a.seen.map((s) => s.job)).toEqual(["transcription"])
    expect(b.seen.map((s) => [s.job, s.apiKey])).toEqual([["parsing", "k2"]])
  })
})

describe("a fake provider in the pipeline", () => {
  test("works without changing the pipeline", async () => {
    const { provider, seen } = recordingProvider("fake")
    const ai = createAi({ AI_PROVIDER: "fake", AI_API_KEY: "k" }, [provider])
    const recipe = await extractRecipe(
      { type: "text", text: "Pancakes" },
      { ai }
    )
    expect(recipe.title).toBe("Pancakes")
    expect(seen.map((s) => s.job)).toEqual(["parsing"])
  })
})

describe("parseJsonReply", () => {
  test("reads plain JSON, fenced JSON and JSON with chatter around it", () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonReply('Here you go:\n{"a":{"b":2}}\nEnjoy!')).toEqual({
      a: { b: 2 },
    })
  })

  test("throws on text without JSON", () => {
    expect(() => parseJsonReply("Sorry, I can't.")).toThrow()
  })
})
