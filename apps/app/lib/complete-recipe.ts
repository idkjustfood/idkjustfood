import { useMutation } from "@tanstack/react-query"

import { toRecipeLanguage, type Ingredient, type Step } from "@workspace/schemas"

import { api, ApiError, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import i18n from "@/lib/i18n"

/** The recipe's lists with the AI's additions, and which items are new. */
export type CompletedRecipe = {
  ingredients: Ingredient[]
  steps: Step[]
  addedIngredients: number[]
  addedSteps: number[]
}

const knownCodes = ["ai_not_configured", "ai_failed", "nothing_to_add", "invalid_recipe"]

/**
 * A translated text for a failed completion, chosen by the server's error code. The server's
 * own message is English only, so it is never shown.
 */
export function completeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return i18n.t("recipes:complete.errors.network")
    if (error.code && knownCodes.includes(error.code)) {
      return i18n.t(`recipes:complete.errors.${error.code}`)
    }
  }
  return i18n.t("recipes:complete.errors.generic")
}

/** The added items only, in the order they appear in the recipe. */
export function addedItems(result: CompletedRecipe) {
  return {
    ingredients: result.addedIngredients.map((i) => result.ingredients[i]!),
    steps: result.addedSteps.map((i) => result.steps[i]!),
  }
}

/** Asks the AI to write what is missing. Nothing is saved until the person confirms. */
export function useCompleteRecipe(recipeId: string) {
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (message: string): Promise<CompletedRecipe> => {
      if (demo) throw new ApiError("Sample data", 0)
      return call(
        api.POST("/api/recipes/{recipeId}/complete", {
          params: { path: { recipeId } },
          body: {
            message: message.trim(),
            language: toRecipeLanguage(i18n.language),
          },
        })
      )
    },
  })
}
