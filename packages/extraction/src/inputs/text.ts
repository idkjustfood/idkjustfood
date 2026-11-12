import { ExtractionError } from "../errors.js"
import type { InputModule } from "./types.js"

/** Longest pasted text we accept, in characters. */
export const maxTextLength = 20_000

function check(text: string) {
  const value = text.trim()
  if (!value) throw new ExtractionError("invalid_input", "The text is empty.")
  if (value.length > maxTextLength) {
    throw new ExtractionError(
      "invalid_input",
      `The text is too long. The limit is ${maxTextLength} characters.`
    )
  }
  return value
}

/** Plain text pasted by the user. */
export const text: InputModule = {
  id: "text",
  needsAi: true,
  canHandle: (input) => input.type === "text",

  validate(input) {
    if (input.type === "text") check(input.text)
  },

  async gather(input) {
    if (input.type !== "text") {
      throw new ExtractionError("invalid_input", "Expected text.")
    }
    return {
      source: { kind: "text", label: null, url: null },
      texts: [{ label: "Pasted text", text: check(input.text) }],
      images: [],
    }
  },
}
