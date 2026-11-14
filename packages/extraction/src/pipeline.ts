import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { silentLogger, type Logger } from "@workspace/logger"
import {
  toRecipeLanguage,
  type RecipeContent,
  type RecipeLanguage,
} from "@workspace/schemas"

import type { Ai, AiJob } from "./ai/types.js"
import { ExtractionError } from "./errors.js"
import { inputModules, selectInput } from "./inputs/index.js"
import type { ExtractionInput, Gathered, InputModule } from "./inputs/types.js"
import { systemMedia, type MediaTools } from "./media.js"
import { fetchPublicPage } from "./net/public-url.js"
import {
  keepStructure,
  readExtractedRecipe,
  toRecipeContent,
  type ExtractedRecipe,
} from "./recipe-output.js"

export type PipelineOptions = {
  ai: Ai
  /** Defaults to all built-in modules. Tests pass their own. */
  modules?: InputModule[]
  media?: MediaTools
  fetchPage?: (url: string) => Promise<{ url: string; html: string }>
  /** Where the temporary folder is made. Defaults to the system temp folder. */
  tempRoot?: string
  maxFrames?: number
  /**
   * The language to write the recipe in, whatever the language of the source. Empty
   * keeps the language of the source (nothing is translated).
   */
  language?: RecipeLanguage
  /** Where progress and failures are logged. Defaults to a logger that writes nothing. */
  logger?: Logger
}

/**
 * Runs one step of the pipeline and logs how long it took, or why it failed.
 * Failures with an `ExtractionError` are expected (bad link, no recipe), so they are
 * a warning without a stack. Anything else is a bug or an outage and is an error.
 */
async function step<T>(
  log: Logger,
  name: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> {
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  log.debug("step started", { step: name, ...fields })
  try {
    const result = await run()
    log.info("step done", { step: name, durationMs: elapsed(), ...fields })
    return result
  } catch (cause) {
    if (cause instanceof ExtractionError) {
      log.warn("step failed", {
        step: name,
        durationMs: elapsed(),
        code: cause.code,
        reason: cause.message,
        ...fields,
      })
    } else {
      log.error("step failed", {
        step: name,
        durationMs: elapsed(),
        err: cause,
        ...fields,
      })
    }
    throw cause
  }
}

/** The AI provider and model of a job, for the logs. */
const aiFields = (ai: Ai, job: AiJob) => ({ ...ai.describe?.(job) })

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
async function readMaterial(gathered: Gathered, ai: Ai, log: Logger) {
  const { audio, images } = gathered
  const [transcript, seen] = await Promise.all([
    audio
      ? step(log, "transcription", aiFields(ai, "transcription"), () =>
          ai.transcribe(audio)
        )
      : "",
    images.length > 0
      ? step(
          log,
          "vision",
          { ...aiFields(ai, "vision"), images: images.length },
          () => ai.readImages(images)
        )
      : "",
  ])
  return buildMaterial([
    ...gathered.texts,
    { label: "Spoken words in the video", text: transcript },
    { label: gathered.imagesLabel ?? "Text read from the images", text: seen },
  ])
}

/**
 * Translates a recipe that a web page already contains (no AI was needed to read it).
 * Skipped when no language is wanted, when the page says it is in that language, and
 * when no AI key is set: then the recipe stays in the language of the page.
 * Only the words come from the AI; amounts and units stay as the page has them.
 */
async function translateFound(
  recipe: ExtractedRecipe,
  pageLanguage: string | undefined,
  options: PipelineOptions,
  log: Logger
): Promise<ExtractedRecipe> {
  const { language } = options
  if (!language || toRecipeLanguage(pageLanguage) === language) return recipe
  try {
    return await step(
      log,
      "translation",
      { ...aiFields(options.ai, "parsing"), language },
      async () => {
        const material = buildMaterial([
          {
            label: "Recipe data found in the page",
            text: JSON.stringify(recipe),
          },
        ])
        const raw = await options.ai.parseRecipe(material, { language })
        return keepStructure(recipe, readExtractedRecipe(raw))
      }
    )
  } catch (cause) {
    if (cause instanceof ExtractionError && cause.code === "ai_not_configured") {
      log.info("no AI key set, the recipe stays in the language of the page")
      return recipe
    }
    throw cause
  }
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
  const log = options.logger ?? silentLogger
  const module = selectInput(input, options.modules ?? inputModules)
  const source = { source: module.id }
  log.info("extraction started", { ...source, input: input.type })

  const workDir = await mkdtemp(
    join(options.tempRoot ?? tmpdir(), "idkjustfood-")
  )
  try {
    // "gather" is where videos and pages are downloaded.
    const gathered = await step(log, "gather", source, () =>
      module.gather(input, {
        workDir,
        media: options.media ?? systemMedia,
        fetchPage: options.fetchPage ?? ((url) => fetchPublicPage(url)),
        maxFrames: options.maxFrames ?? 12,
      })
    )

    if (gathered.recipe) {
      log.info("recipe data found in the source, no AI used", source)
      const recipe = await translateFound(
        gathered.recipe,
        gathered.language,
        options,
        log
      )
      return toRecipeContent(recipe, gathered.source)
    }

    const material = await readMaterial(gathered, options.ai, log)
    if (!material.trim()) {
      const error = new ExtractionError(
        "no_recipe_found",
        "Nothing readable was found there: no caption, speech, text or picture content."
      )
      log.warn("step failed", {
        step: "material",
        code: error.code,
        reason: error.message,
        ...source,
      })
      throw error
    }
    return await step(
      log,
      "parsing",
      { ...aiFields(options.ai, "parsing"), materialChars: material.length },
      async () => {
        const raw = await options.ai.parseRecipe(material, {
          language: options.language,
        })
        return toRecipeContent(readExtractedRecipe(raw), gathered.source)
      }
    )
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
