import { describe, expect, test } from "bun:test"

import { ExtractionError } from "../errors.js"
import { extractRecipe } from "../pipeline.js"
import { fakeAi, pancakeJson } from "../testing.js"
import { selectInput, inputModules } from "./index.js"
import type { ExtractionInput, InputModule } from "./types.js"

const link = (url: string): ExtractionInput => ({ type: "link", url })
const idOf = (input: ExtractionInput) => selectInput(input).id

describe("selectInput", () => {
  test("picks the video platform from the link host", () => {
    expect(idOf(link("https://www.instagram.com/reel/Cabc123/"))).toBe(
      "instagram"
    )
    expect(idOf(link("https://instagram.com/reels/Cabc123/?igsh=x"))).toBe(
      "instagram"
    )
    expect(idOf(link("https://www.tiktok.com/@chef/video/7123456789"))).toBe(
      "tiktok"
    )
    expect(idOf(link("https://vm.tiktok.com/ZMabc123/"))).toBe("tiktok")
    expect(idOf(link("https://www.youtube.com/shorts/abc123XYZ"))).toBe(
      "youtube-shorts"
    )
    expect(idOf(link("https://youtu.be/abc123XYZ"))).toBe("youtube-shorts")
  })

  test("other web links are websites", () => {
    expect(idOf(link("https://www.example.com/recipes/pancakes"))).toBe(
      "website"
    )
    // A look-alike host is not Instagram.
    expect(idOf(link("https://notinstagram.com/reel/abc"))).toBe("website")
    expect(idOf(link("https://instagram.com.evil.example/reel/abc"))).toBe(
      "website"
    )
  })

  test("uploads and text go to the photo and text modules", () => {
    expect(
      idOf({ type: "image", data: new Uint8Array(), mediaType: "image/png" })
    ).toBe("photo")
    expect(idOf({ type: "text", text: "Pancakes: flour, milk" })).toBe("text")
  })

  test("rejects links that are not web links", () => {
    for (const url of [
      "ftp://example.com/recipe",
      "javascript:alert(1)",
      "not a link",
      "",
    ]) {
      expect(() => selectInput(link(url))).toThrow(ExtractionError)
    }
    try {
      selectInput(link("ftp://example.com"))
    } catch (error) {
      expect((error as ExtractionError).code).toBe("unsupported_link")
      expect((error as ExtractionError).message).toContain("not supported")
    }
  })

  test("a platform link that is not a video is refused with a clear message", () => {
    const profile = link("https://www.instagram.com/some_chef/")
    const module = selectInput(profile)
    expect(module.id).toBe("instagram")
    expect(() => module.validate?.(profile)).toThrow(/not a reel/)

    const channel = link("https://www.youtube.com/@somechannel")
    expect(() => selectInput(channel).validate?.(channel)).toThrow(
      /not a Short/
    )
  })

  test("only the website module can work without AI", () => {
    const needsAi = Object.fromEntries(
      inputModules.map((m) => [m.id, m.needsAi])
    )
    expect(needsAi.website).toBe(false)
    expect(
      needsAi.instagram && needsAi.tiktok && needsAi["youtube-shorts"]
    ).toBe(true)
    expect(needsAi.photo && needsAi.text).toBe(true)
  })
})

describe("adding an input module", () => {
  // A new input type: a recipe card sent as "card:<text>" links. It is only registered
  // in the list passed to the pipeline; no pipeline code is touched.
  const cardModule: InputModule = {
    id: "recipe-card",
    needsAi: true,
    canHandle: (input) =>
      input.type === "link" && input.url.startsWith("card:"),
    async gather(input) {
      if (input.type !== "link") throw new Error("unreachable")
      return {
        source: { kind: "import", label: "Recipe card", url: null },
        texts: [{ label: "Card", text: input.url.slice("card:".length) }],
        images: [],
      }
    },
  }

  test("is used by the pipeline without any other change", async () => {
    const ai = fakeAi()
    const recipe = await extractRecipe(link("card:Pancakes, 200 g flour"), {
      ai,
      modules: [cardModule, ...inputModules],
    })
    expect(recipe.title).toBe(pancakeJson.title)
    expect(recipe.source.label).toBe("Recipe card")
    expect(ai.calls.parseRecipe[0]).toContain("Pancakes, 200 g flour")
  })

  test("is unknown without being registered", () => {
    expect(() => selectInput(link("card:Pancakes"), [])).toThrow(
      /not supported/
    )
  })
})
