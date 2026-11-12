import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { RecipeContent } from "@workspace/schemas"

import type { Ai } from "./ai/types.js"
import { ExtractionError } from "./errors.js"
import { inputModules, selectInput } from "./inputs/index.js"
import type { ExtractionInput, Gathered, InputModule } from "./inputs/types.js"
import { systemMedia, type MediaTools } from "./media.js"
import { fetchPublicPage } from "./net/public-url.js"
import { readExtractedRecipe, toRecipeContent } from "./recipe-output.js"

export type PipelineOptions = {
  ai: Ai
  /** Defaults to all built-in modules. Tests pass their own. */
  modules?: InputModule[]
  media?: MediaTools
  fetchPage?: (url: string) => Promise<{ url: string; html: string }>
  /** Where the temporary folder is made. Defaults to the system temp folder. */
  tempRoot?: string
  maxFrames?: number
}

const maxSectionChars = 30_000

/** Joins all that the input gave into one text for the recipe parser. */
function buildMaterial(sections: { label: string; text: string }[]) {
  return sections
    .filter((section) => section.text.trim())
    .map(
      (section) =>
        `### ${section.label}\n${section.text.trim().slice(0, maxSectionChars)}`
    )
    .join("\n\n")
}

/** Collects speech and picture text with the AI, and returns all material as text. */
async function readMaterial(gathered: Gathered, ai: Ai) {
  const [transcript, seen] = await Promise.all([
    gathered.audio ? ai.transcribe(gathered.audio) : "",
    gathered.images.length > 0 ? ai.readImages(gathered.images) : "",
  ])
  return buildMaterial([
    ...gathered.texts,
    { label: "Spoken words in the video", text: transcript },
    { label: gathered.imagesLabel ?? "Text read from the images", text: seen },
  ])
}

/**
 * Turns an input (link, photo, text) into a recipe. Steps: pick the input module,
 * gather text/pictures/audio, let the AI read what is not text yet, parse it all
 * into one recipe, and validate it. Temporary files are always deleted.
 * (`module.validate` is for the API, to refuse bad input before queueing; each module
 * checks its own input again in `gather`.)
 */
export async function extractRecipe(
  input: ExtractionInput,
  options: PipelineOptions
): Promise<RecipeContent> {
  const module = selectInput(input, options.modules ?? inputModules)

  const workDir = await mkdtemp(
    join(options.tempRoot ?? tmpdir(), "idkjustfood-")
  )
  try {
    const gathered = await module.gather(input, {
      workDir,
      media: options.media ?? systemMedia,
      fetchPage: options.fetchPage ?? ((url) => fetchPublicPage(url)),
      maxFrames: options.maxFrames ?? 12,
    })

    if (gathered.recipe)
      return toRecipeContent(gathered.recipe, gathered.source)

    const material = await readMaterial(gathered, options.ai)
    if (!material.trim()) {
      throw new ExtractionError(
        "no_recipe_found",
        "Nothing readable was found there: no caption, speech, text or picture content."
      )
    }
    const raw = await options.ai.parseRecipe(material)
    return toRecipeContent(readExtractedRecipe(raw), gathered.source)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
