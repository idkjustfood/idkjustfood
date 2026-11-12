import { ExtractionError } from "../errors.js"
import { assertPublicUrl } from "../net/public-url.js"
import { htmlToText, readPageRecipe } from "./schema-org.js"
import type { ExtractionInput, InputModule } from "./types.js"

function httpUrl(input: ExtractionInput) {
  if (input.type !== "link") return undefined
  try {
    const url = new URL(input.url)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Any other web link. The page's schema.org Recipe data is used when it is complete
 * (no AI call). Otherwise the page text is handed to the AI.
 */
export const website: InputModule = {
  id: "website",
  needsAi: false,

  canHandle: (input) => !!httpUrl(input),

  async validate(input) {
    const url = httpUrl(input)
    if (!url)
      throw new ExtractionError("invalid_input", "That is not a valid link.")
    await assertPublicUrl(url.toString())
  },

  async gather(input, { fetchPage }) {
    const url = httpUrl(input)
    if (!url)
      throw new ExtractionError("invalid_input", "That is not a valid link.")

    const page = await fetchPage(url.toString())
    const source = {
      kind: "website" as const,
      label: new URL(page.url).hostname.replace(/^www\./, ""),
      url: page.url,
    }
    const { complete, partial } = readPageRecipe(page.html)
    if (complete) return { source, texts: [], images: [], recipe: complete }

    const texts = []
    if (partial) {
      texts.push({
        label: "Recipe data found in the page (may be incomplete)",
        text: JSON.stringify(partial).slice(0, 20_000),
      })
    }
    texts.push({ label: "Text of the web page", text: htmlToText(page.html) })
    return { source, texts, images: [] }
  },
}
