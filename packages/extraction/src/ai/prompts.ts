/** Prompts shared by all providers, so every provider is asked the same thing. */

export const transcribePrompt =
  "Transcribe the speech in this audio word for word, in the language that is spoken. " +
  "Output only the transcript, no comments or timestamps. " +
  "If there is no speech (only music or noise), output exactly: (no speech)"

export const noSpeech = "(no speech)"

export const readImagesPrompt =
  "These images come from a recipe: a cookbook page, a screenshot, or frames of a cooking video. " +
  "Write down everything in them that belongs to the recipe: the title, servings, times, " +
  "every ingredient with its amount and unit exactly as shown, and every step. " +
  "Copy on-screen text word for word, in its own language. " +
  "If frames repeat the same text, write it once. Do not add anything that is not shown. " +
  "If there is no recipe text or food in the images, output exactly: (nothing)"

export const nothingFound = "(nothing)"

export const parseRecipeSystem = `You turn the material of a recipe into one JSON object. Reply with the JSON only.

Rules:
- Use only what the material says. Never invent a detail. If an amount is not given, set "quantity" to null (and "unit" to null if there is no unit too).
- If the material conflicts with itself (for example caption and on-screen text), prefer on-screen text and written lists over spoken words for amounts.
- Write the recipe in the language of the material.
- "quantity" is a number: write 1/2 as 0.5 and 1 1/2 as 1.5. Keep the unit as written ("g", "cup", "tbsp", "clove"). Put extras like "finely chopped" in "note".
- "servings" is a whole number, or null if the material does not say.
- "prepMinutes" and "cookMinutes" are whole minutes, or null if not said.
- "steps": one object per step, in order, in short clear sentences. Keep times in the text ("bake for 30 minutes").
- "tags": up to 8 short tags: the cuisine (for example "Italian"), the diet when clear (for example "Vegetarian", "Vegan", "Gluten-free"), and one cooking-time tag: "Under 15 min", "Under 30 min", "Under 1 hour" or "Over 1 hour" (only if the material allows you to tell).
- If the material contains no recipe at all, reply {"error": "no recipe found"}.

JSON shape:
{
  "title": string,
  "description": string (one or two sentences, may be empty),
  "servings": number | null,
  "prepMinutes": number | null,
  "cookMinutes": number | null,
  "tags": string[],
  "ingredients": [{ "name": string, "quantity": number | null, "unit": string | null, "note": string | null }],
  "steps": [{ "text": string }]
}`

/** Finds the JSON object in a model's reply, also when it is wrapped in a code fence. */
export function parseJsonReply(reply: string): unknown {
  const text = reply.trim()
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const candidate = fenced?.[1]?.trim() ?? text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  const slice =
    start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate
  return JSON.parse(slice)
}
