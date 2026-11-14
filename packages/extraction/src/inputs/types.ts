import type { Source } from "@workspace/schemas"

import type { AudioInput, ImageInput } from "../ai/types.js"
import type { MediaTools } from "../media.js"
import type { ExtractedRecipe } from "../recipe-output.js"

/** What the user sent in. */
export type ExtractionInput =
  | { type: "link"; url: string }
  | { type: "image"; data: Uint8Array; mediaType: string }
  | { type: "text"; text: string }

/** A piece of text found in the input, with a name the AI can read. */
export type Material = { label: string; text: string }

/** What an input module hands to the pipeline. */
export type Gathered = {
  source: Source
  /** Text found directly: a caption, the text of a page, pasted text. */
  texts: Material[]
  /** Pictures to read: a photo, or frames of a video. */
  images: ImageInput[]
  /** Speech to transcribe (videos). */
  audio?: AudioInput
  /**
   * The language the source says it is written in, when it says (a web page does).
   * Used to skip the translation when the recipe is already in the wanted language.
   */
  language?: string
  /** Label for what the images show, if "Text read from the images" is not right. */
  imagesLabel?: string
  /**
   * A finished recipe the source already contains (a page with schema.org data).
   * When it is set, the pipeline makes no AI call.
   */
  recipe?: ExtractedRecipe
}

/** Everything a module may need while gathering. The pipeline owns and cleans `workDir`. */
export type InputContext = {
  /** An empty temporary folder for downloads. Deleted after the job. */
  workDir: string
  media: MediaTools
  fetchPage(url: string): Promise<{ url: string; html: string }>
  maxFrames: number
}

/**
 * One way to add a recipe: a platform (Instagram, TikTok, ...) or an input type
 * (website, photo, text). To add one, write a module and add it to `inputModules`
 * in `inputs/index.ts`. See `docs/adding-an-input.md`.
 */
export interface InputModule {
  id: string
  /** True when this module is the one for the input. The first match wins. */
  canHandle(input: ExtractionInput): boolean
  /**
   * True when the module always needs the AI. When false (websites), the AI is only
   * needed if the page has no complete recipe data.
   */
  needsAi: boolean
  /**
   * Checks the input quickly, before a job is queued. Throws an `ExtractionError`
   * with a message for the person when the input is not usable.
   */
  validate?(input: ExtractionInput): Promise<void> | void
  /** Collects the text, pictures and audio of the input. */
  gather(input: ExtractionInput, context: InputContext): Promise<Gathered>
}
