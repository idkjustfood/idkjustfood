import { z } from "zod"

import {
  IngredientSchema,
  StepSchema,
  type Ingredient,
  type Step,
} from "./recipe.js"
import { arrangeSections } from "./sections.js"

/** The most the AI may add to a recipe in one go. */
export const maxCompletionItems = 60

/** What the AI adds to a recipe: only the new ingredients and steps. */
export const RecipeAdditionSchema = z.object({
  ingredients: z.array(IngredientSchema).max(maxCompletionItems),
  steps: z.array(StepSchema).max(maxCompletionItems),
})
export type RecipeAddition = z.infer<typeof RecipeAdditionSchema>

/** The longest message a person can send to complete a recipe. */
export const maxCompletionMessage = 1000

/**
 * A recipe with the AI's additions merged in. `addedIngredients` and `addedSteps` are
 * the places (indexes) of the new items in the merged lists, so a screen can mark them.
 */
export type CompletedRecipe<I extends Ingredient = Ingredient, S extends Step = Step> = {
  ingredients: I[]
  steps: S[]
  addedIngredients: number[]
  addedSteps: number[]
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, " ") ===
  b.trim().toLowerCase().replace(/\s+/g, " ")

const sectionOf = (item: { section?: string | null }) =>
  item.section?.trim() || null

/**
 * Adds what the AI wrote to a recipe. The existing ingredients and steps are never
 * changed, moved or removed.
 *
 * - A new ingredient whose name is already in the same part of the recipe is dropped
 *   (no duplicates). The same name in another part ("salt" in the dough and in the
 *   sauce) is kept.
 * - New ingredients and steps go after the existing ones. When they have a part
 *   ("Dough"), they stay together under that headline.
 * - A new part that has the same name as an existing one (ignoring case) joins it.
 *
 * Servings are not touched: they stay what the original recipe says.
 */
export function mergeCompletion<I extends Ingredient, S extends Step>(
  existing: { ingredients: I[]; steps: S[] },
  addition: RecipeAddition
): CompletedRecipe<I | Ingredient, S | Step> {
  const known = new Map<string, string>()
  for (const item of [...existing.ingredients, ...existing.steps]) {
    const name = sectionOf(item)
    if (name) known.set(name.toLowerCase(), name)
  }
  /** Writes a new part the way the recipe already spells it. */
  const named = <T extends { section?: string | null }>(item: T): T => {
    const name = sectionOf(item)
    const { section: _drop, ...rest } = item
    return (name ? { ...rest, section: known.get(name.toLowerCase()) ?? name } : rest) as T
  }

  const newIngredients: Ingredient[] = []
  for (const candidate of addition.ingredients.map(named)) {
    const duplicate = [...existing.ingredients, ...newIngredients].some(
      (other) =>
        sameName(other.name, candidate.name) &&
        sectionOf(other) === sectionOf(candidate)
    )
    if (!duplicate) newIngredients.push(candidate)
  }
  const newSteps: Step[] = addition.steps.map(named)

  // Only the position changes: a new part stays together, existing items keep their order.
  const merge = <T extends { section?: string | null }>(
    old: T[],
    added: T[]
  ) => {
    const wrapped = [
      ...old.map((item) => ({ item, added: false, section: item.section })),
      ...added.map((item) => ({ item, added: true, section: item.section })),
    ]
    const all = arrangeSections(wrapped)
    return {
      list: all.map((entry) => entry.item),
      indexes: all.flatMap((entry, index) => (entry.added ? [index] : [])),
    }
  }

  const ingredients = merge<Ingredient>(existing.ingredients, newIngredients)
  const steps = merge<Step>(existing.steps, newSteps)
  return {
    ingredients: ingredients.list,
    steps: steps.list,
    addedIngredients: ingredients.indexes,
    addedSteps: steps.indexes,
  }
}
