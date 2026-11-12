import { ExtractionError } from "../errors.js"
import { instagram } from "./instagram.js"
import { photo } from "./photo.js"
import { text } from "./text.js"
import { tiktok } from "./tiktok.js"
import type { ExtractionInput, InputModule } from "./types.js"
import { website } from "./website.js"
import { youtube } from "./youtube.js"

export * from "./types.js"
export { checkImage, imageTypes, maxImageBytes } from "./photo.js"
export { maxTextLength } from "./text.js"

/**
 * All input modules, in the order they are tried. The first one whose `canHandle`
 * is true wins, so keep the catch-all `website` after the video platforms.
 * To add an input or a platform: write a module and add it here. Nothing else changes.
 */
export const inputModules: InputModule[] = [
  instagram,
  tiktok,
  youtube,
  photo,
  text,
  website,
]

/** Picks the module for an input. Throws "unsupported link" when none fits. */
export function selectInput(
  input: ExtractionInput,
  modules: InputModule[] = inputModules
): InputModule {
  const found = modules.find((module) => module.canHandle(input))
  if (!found) {
    throw new ExtractionError(
      "unsupported_link",
      input.type === "link"
        ? "That link is not supported. Use a link to an Instagram reel, TikTok, YouTube Short or a recipe website."
        : "That input is not supported."
    )
  }
  return found
}
