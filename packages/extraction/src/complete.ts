import {
  fitIngredientUnits,
  mergeCompletion,
  RecipeAdditionSchema,
  type CompletedRecipe,
  type Ingredient,
  type RecipeLanguage,
  type Step,
} from "@workspace/schemas"

import type { Ai } from "./ai/types.js"
import { completeRecipeSystem } from "./ai/prompts.js"
import { ExtractionError } from "./errors.js"

/** The parts of a recipe the AI needs to see. Nutrition, tags and source stay out of it. */
export type RecipeToComplete = {
  title: string
  servings: number
  ingredients: Ingredient[]
  steps: Step[]
}

/** What the AI is told: the recipe so far, then the person's message. */
export function completionMaterial(recipe: RecipeToComplete, message: string) {
  return JSON.stringify({
    recipe: {
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
    },
    message,
  })
}

/**
 * Asks the AI to write the missing part of a recipe and merges it in. The existing
 * ingredients and steps are never changed: the AI only returns new ones, and `mergeCompletion`
 * adds them. Fails with `nothing_to_add` when the AI had nothing to add.
 */
export async function completeRecipe(
  ai: Ai,
  recipe: RecipeToComplete,
  message: string,
  language?: RecipeLanguage
): Promise<CompletedRecipe> {
  const raw = await ai.parseRecipe(completionMaterial(recipe, message), {
    language,
    instruction: completeRecipeSystem(language),
  })
  const object = raw && typeof raw === "object" ? (raw as object) : {}
  const result = RecipeAdditionSchema.safeParse({
    ingredients: [],
    steps: [],
    ...object,
    ...("ingredients" in object
      ? { ingredients: fitIngredientUnits((object as { ingredients: unknown }).ingredients) }
      : {}),
  })
  if (!result.success) {
    throw new ExtractionError(
      "invalid_recipe",
      "The AI's answer is not usable. Try again, or use a different parsing model."
    )
  }
  const merged = mergeCompletion(recipe, result.data)
  if (merged.addedIngredients.length === 0 && merged.addedSteps.length === 0) {
    throw new ExtractionError(
      "nothing_to_add",
      "The AI had nothing to add. Describe what is missing, for example \"add a pizza dough\"."
    )
  }
  return merged
}
