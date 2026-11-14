import { z } from "zod"

import { RecipeLanguageSchema, type RecipeLanguage } from "./language.js"
import type { Ingredient } from "./recipe.js"

/**
 * Pantry staples: the things a person or household always has at home (salt, pepper, oil).
 * They are left out when a recipe's ingredients are added to a shopping list.
 */

const name = z.string().trim().min(1).max(200)

export const PantryItemSchema = z.object({ id: z.string(), name })
export type PantryItem = z.infer<typeof PantryItemSchema>

export const PantrySchema = z.object({
  /** The household the pantry belongs to, or null for the person's own pantry. */
  householdId: z.string().nullable(),
  items: z.array(PantryItemSchema),
})
export type Pantry = z.infer<typeof PantrySchema>

/** What a client sends to add a staple. The client may choose the `id`, like for shopping items. */
export const PantryItemInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name,
  /** Empty (null) means the person's own pantry. */
  householdId: z.string().nullable().optional(),
  /** Used when the pantry has to be made first, to pick the default list. */
  language: RecipeLanguageSchema.optional(),
})
export type PantryItemInput = z.infer<typeof PantryItemInputSchema>

/** What a client sends to reset a pantry to the default list. */
export const PantryResetSchema = z.object({
  householdId: z.string().nullable().optional(),
  language: RecipeLanguageSchema.optional(),
})
export type PantryReset = z.infer<typeof PantryResetSchema>

/**
 * The default staples, in each language of the app. A pantry starts with the list of the
 * language the person uses, because recipes are written in that language and names are
 * matched as written. To add a language, add its list here.
 */
export const defaultPantryItems: Record<RecipeLanguage, readonly string[]> = {
  en: ["Salt", "Pepper", "Black pepper", "Oil", "Olive oil", "Vegetable oil"],
  de: ["Salz", "Pfeffer", "Schwarzer Pfeffer", "Öl", "Olivenöl", "Pflanzenöl"],
  es: [
    "Sal",
    "Pimienta",
    "Pimienta negra",
    "Aceite",
    "Aceite de oliva",
    "Aceite vegetal",
  ],
  fr: [
    "Sel",
    "Poivre",
    "Poivre noir",
    "Huile",
    "Huile d'olive",
    "Huile végétale",
  ],
  it: ["Sale", "Pepe", "Pepe nero", "Olio", "Olio d'oliva", "Olio di semi"],
}

/** The default staples for a language (English when the language is not given). */
export function defaultPantry(language: RecipeLanguage = "en") {
  return [...defaultPantryItems[language]]
}

/** A name as used for matching: no difference in upper/lower case or extra spaces. */
export function pantryKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

/**
 * Splits a recipe's ingredients into the ones to add and the ones left out because they
 * are on the pantry list. Only the whole name is compared ("sea salt" is not "salt").
 */
export function splitStaples(
  ingredients: Ingredient[],
  staples: Iterable<string>
) {
  const keys = new Set([...staples].map(pantryKey))
  const needed: Ingredient[] = []
  const skipped: Ingredient[] = []
  for (const ingredient of ingredients) {
    ;(keys.has(pantryKey(ingredient.name)) ? skipped : needed).push(ingredient)
  }
  return { needed, skipped }
}
