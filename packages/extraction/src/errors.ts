/** Codes for the failures a person can run into. The message is shown to them as it is. */
export type ExtractionErrorCode =
  | "unsupported_link"
  | "private_address"
  | "invalid_input"
  | "ai_not_configured"
  | "model_cannot_read_images"
  | "ai_failed"
  | "video_unavailable"
  | "video_too_long"
  | "tools_missing"
  | "page_unreachable"
  | "no_recipe_found"
  | "invalid_recipe"

/** A failure with a message that is safe and useful to show to the user. */
export class ExtractionError extends Error {
  constructor(
    readonly code: ExtractionErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ExtractionError"
  }
}
