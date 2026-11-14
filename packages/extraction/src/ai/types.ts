/**
 * The three jobs the AI does for us. The pipeline only knows these interfaces,
 * never a specific provider. See `docs/ai-providers.md` for how to add one.
 */

import type { RecipeLanguage } from "@workspace/schemas"

export type ImageInput = { data: Uint8Array; mediaType: string }
export type AudioInput = { data: Uint8Array; mediaType: string }

/** Turns speech into text. */
export interface Transcriber {
  /** Returns the spoken words, or an empty text when there is no speech. */
  transcribe(audio: AudioInput): Promise<string>
}

/** Reads the text and the recipe details that can be seen in pictures. */
export interface ImageReader {
  /**
   * Returns everything the images show that matters for a recipe (written text,
   * ingredients, amounts, steps), as plain text. Empty when there is nothing.
   * Fails with `model_cannot_read_images` when the model does not accept images.
   */
  readImages(images: ImageInput[]): Promise<string>
}

export type ParseOptions = {
  /**
   * The language to write the recipe in. When the material is in another language, the
   * AI translates it. Empty keeps the language of the material. Every provider must
   * give the model the instruction from `parseRecipeSystem(language)`.
   */
  language?: RecipeLanguage
}

/** Turns messy text into a recipe. */
export interface RecipeParser {
  /**
   * Returns the recipe as a JSON value. The pipeline validates it, so the
   * provider only has to hand over what the model answered.
   */
  parseRecipe(material: string, options?: ParseOptions): Promise<unknown>
}

/** What the pipeline works with: one object with the three jobs. */
export interface Ai extends Transcriber, ImageReader, RecipeParser {
  /**
   * Which provider and model a job uses, for the logs. Never include keys or addresses.
   * Optional: fakes in tests leave it out.
   */
  describe?(job: AiJob): { provider: string; model: string } | undefined
}

export type AiJob = "transcription" | "vision" | "parsing"

export type ProviderOptions = {
  apiKey: string
  baseUrl: string | undefined
  model: string
}

/** A provider offers the three jobs on top of one AI service. */
export interface AiProvider {
  id: string
  /** Used when no model is set for a job. */
  defaultModels: Record<AiJob, string>
  defaultBaseUrl?: string
  transcriber(options: ProviderOptions): Transcriber
  imageReader(options: ProviderOptions): ImageReader
  recipeParser(options: ProviderOptions): RecipeParser
}
