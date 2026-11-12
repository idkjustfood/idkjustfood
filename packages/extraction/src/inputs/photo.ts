import { ExtractionError } from "../errors.js"
import type { InputModule } from "./types.js"

/** Largest photo we accept, in bytes. */
export const maxImageBytes = 10 * 1024 * 1024

export const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

/** The real type of an image from its first bytes, or undefined when it is not one we support. */
export function sniffImageType(
  data: Uint8Array
): (typeof imageTypes)[number] | undefined {
  const at = (i: number) => data[i]
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg"
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47)
    return "image/png"
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38)
    return "image/gif"
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return "image/webp"
  }
  return undefined
}

/** Checks size and type of an upload. Returns the real media type. */
export function checkImage(data: Uint8Array) {
  if (data.byteLength === 0) {
    throw new ExtractionError("invalid_input", "The image is empty.")
  }
  if (data.byteLength > maxImageBytes) {
    throw new ExtractionError(
      "invalid_input",
      `The image is too large. The limit is ${maxImageBytes / 1024 / 1024} MB.`
    )
  }
  const type = sniffImageType(data)
  if (!type) {
    throw new ExtractionError(
      "invalid_input",
      "That file is not a supported image. Use a JPEG, PNG, WebP or GIF."
    )
  }
  return type
}

/** A photo or screenshot, for example of a cookbook page. */
export const photo: InputModule = {
  id: "photo",
  needsAi: true,
  canHandle: (input) => input.type === "image",

  validate(input) {
    if (input.type === "image") checkImage(input.data)
  },

  async gather(input) {
    if (input.type !== "image") {
      throw new ExtractionError("invalid_input", "Expected an image.")
    }
    const mediaType = checkImage(input.data)
    return {
      source: { kind: "photo", label: "Photo", url: null },
      texts: [],
      images: [{ data: input.data, mediaType }],
      imagesLabel: "Text read from the photo",
    }
  },
}
