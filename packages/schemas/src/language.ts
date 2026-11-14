import { z } from "zod"

/**
 * The languages a recipe can be written in: the languages of the app. The AI writes
 * every new recipe in the language the person picked in the app. To add a language,
 * add its code here, with its English name for the AI, and its folder in
 * `apps/app/locales`.
 */
export const recipeLanguageNames = {
  en: "English",
  de: "German",
  es: "Spanish",
  fr: "French",
  it: "Italian",
} as const

export type RecipeLanguage = keyof typeof recipeLanguageNames

export const recipeLanguages = Object.keys(recipeLanguageNames) as [
  RecipeLanguage,
  ...RecipeLanguage[],
]

export const RecipeLanguageSchema = z.enum(recipeLanguages)

/**
 * Reads a language code such as "de", "de-AT" or "DE_at" as one of the supported
 * languages. Returns undefined when it is empty or not supported.
 */
export function toRecipeLanguage(
  code: string | null | undefined
): RecipeLanguage | undefined {
  const base = code?.trim().toLowerCase().split(/[-_]/)[0]
  return recipeLanguages.find((language) => language === base)
}
