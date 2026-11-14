import {
  recipeLanguageNames,
  tagGroupKeys,
  tagsByGroup,
  type RecipeLanguage,
} from "@workspace/schemas"

/** Prompts shared by all providers, so every provider is asked the same thing. */

/** What each group of tags is for, so the AI picks the right ones. */
const tagGroupHelp = {
  cuisine: "the cuisine or country the dish comes from",
  dish: "what kind of dish it is",
  diet: "only when the recipe clearly fits the diet",
  nutrition: "only when the recipe clearly fits",
  time: "preparing and cooking together, pick at most one",
  meal: "when it is eaten: breakfast, midday (lunch) or afternoon (dinner)",
} as const

/** The list of tags the AI may choose from, one line per group. */
export function tagListForPrompt() {
  return tagGroupKeys
    .map(
      (group) =>
        `  - ${group} (${tagGroupHelp[group]}): ${tagsByGroup[group].join(", ")}`
    )
    .join("\n")
}

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

/**
 * The rule about the language of the recipe. With a language, the AI writes in it and
 * translates when the material is in another one. Words, not values, are translated.
 */
export function languageRule(language?: RecipeLanguage) {
  if (!language) return "Write the recipe in the language of the material."
  const name = recipeLanguageNames[language]
  return (
    `Write the recipe in ${name}: the title, the description, the ingredient names, the notes, the section names and the steps. ` +
    `If the material is in another language, translate it into ${name}. If it is already in ${name}, keep its words. ` +
    "Translating changes words only: keep every quantity, unit, time and number as it is, never add an amount or detail that the material does not give, " +
    "and leave a missing amount empty. The \"unit\" and the \"tags\" are fixed keys, not words: never translate them."
  )
}

/** The system prompt of the recipe parser, for the language the recipe must be written in. */
export const parseRecipeSystem = (language?: RecipeLanguage) => `You turn the material of a recipe into one JSON object. Reply with the JSON only.

Rules:
- Use only what the material says. Never invent a detail. If an amount is not given, set "quantity" to null (and "unit" to null if there is no unit too).
- If the material conflicts with itself (for example caption and on-screen text), prefer on-screen text and written lists over spoken words for amounts.
- ${languageRule(language)}
- "quantity" is a number: write 1/2 as 0.5 and 1 1/2 as 1.5. "unit" is one of these keys, or null when there is no unit: g, kg, mg, ml, l, tsp, tbsp, cup, oz, lb, fl_oz, piece, pinch, clove, bunch, slice, can, pack (tsp = teaspoon, TL; tbsp = tablespoon, EL; piece = Stück). If the material uses a unit that is not in this list (for example "handful"), set "unit" to null and write that word in "note". Put extras like "finely chopped" in "note" too.
- "servings" is a whole number, or null if the material does not say.
- "prepMinutes" and "cookMinutes" are whole minutes, or null if not said.
- "steps": one object per step, in order, in short clear sentences. Keep times in the text ("bake for 30 minutes").
- "section": most recipes have no parts, and then "section" is null everywhere. Only when the material clearly splits the recipe into named parts (for example "For the dough" and "For the sauce"), write the short name of the part ("Dough", "Sauce") in "section" of every ingredient and step that belongs to it, always spelled the same way for the same part. Never invent parts, and do not use a section for a recipe with only one part. An ingredient or step that belongs to no part has "section": null.
- "tags": choose ONLY from the list of tag keys below, using the key exactly as written. Never write any other tag. Pick a tag only when the material makes it clear, and leave the list empty when nothing fits. At most one or two cuisines, and at most one time tag (the smallest "under" value the recipe fits in, preparing and cooking together).
${tagListForPrompt()}
- If the material contains no recipe at all, reply {"error": "no recipe found"}.

JSON shape:
{
  "title": string,
  "description": string (one or two sentences, may be empty),
  "servings": number | null,
  "prepMinutes": number | null,
  "cookMinutes": number | null,
  "tags": the chosen tag keys (string[]),
  "ingredients": [{ "name": string, "quantity": number | null, "unit": "g" | "kg" | "mg" | "ml" | "l" | "tsp" | "tbsp" | "cup" | "oz" | "lb" | "fl_oz" | "piece" | "pinch" | "clove" | "bunch" | "slice" | "can" | "pack" | null, "note": string | null, "section": string | null }],
  "steps": [{ "text": string, "section": string | null }]
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
