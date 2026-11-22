import {
  cleanReading,
  ReceiptReadingSchema,
  type ReceiptItem,
  type ReceiptReading,
} from "@workspace/schemas"

import type { Ai, ImageInput } from "./ai/types.js"
import {
  parseReceiptSystemFor,
  readReceiptPrompt,
  type ReceiptCategory,
} from "./ai/prompts.js"
import { ExtractionError } from "./errors.js"
import { checkImage } from "./inputs/photo.js"

/** What was read from a receipt photo. A value that could not be read is null, never a guess. */
export type ReceiptDetails = {
  shop: string | null
  /** `YYYY-MM-DD` */
  date: string | null
  totalCents: number | null
  /** The lines, each in one of the offered categories or none. */
  items: ReceiptItem[]
}

/**
 * Reads the shop, the date, the total and the lines from the photo of a receipt, in two steps: the vision
 * model copies the printed text, then the parsing model picks the three values from that text.
 * Values that are not clearly there come back as null, and anything that is not a real date or a
 * sensible amount is dropped (`cleanReading`). Fails when the image is not a supported one, when
 * no text could be read, or when the AI's answer is unusable.
 */
export async function readReceipt(
  ai: Ai,
  image: Pick<ImageInput, "data">,
  /** The categories of the space. The AI puts each line in one of them, and in no other. */
  categories: readonly ReceiptCategory[] = []
): Promise<ReceiptDetails> {
  const mediaType = checkImage(image.data)
  const text = (
    await ai.readImages([{ data: image.data, mediaType }], {
      instruction: readReceiptPrompt,
    })
  ).trim()
  if (!text) {
    throw new ExtractionError(
      "invalid_input",
      "No receipt text could be read from the photo. Try a sharper photo, with the whole receipt in it."
    )
  }
  const raw = await ai.parseRecipe(text, { instruction: parseReceiptSystemFor(categories) })
  const parsed = ReceiptReadingSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ExtractionError(
      "invalid_recipe",
      "The AI's answer is not usable. Try again, or use a different parsing model."
    )
  }
  return cleanReading(
    parsed.data as ReceiptReading,
    categories.map((c) => c.id)
  )
}
