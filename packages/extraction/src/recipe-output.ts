import { z } from "zod"

import {
  fitIngredientUnits,
  fitTags,
  IngredientSchema,
  RecipeContentSchema,
  StepSchema,
  TagsSchema,
  emptyNutrition,
  type RecipeContent,
  type Source,
} from "@workspace/schemas"

import { ExtractionError } from "./errors.js"

const minutes = z.number().int().min(0).max(100_000).nullable()

/**
 * What the AI (or a web page's recipe data) gives us. It has no id, source or
 * nutrition: those are added by `toRecipeContent`. Servings may be empty.
 */
export const ExtractedRecipeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  servings: z.number().int().min(1).max(1000).nullable().default(null),
  prepMinutes: minutes.default(null),
  cookMinutes: minutes.default(null),
  /** Only tags from the fixed list; `readExtractedRecipe` fits what the AI wrote. */
  tags: TagsSchema.default([]),
  ingredients: z.array(IngredientSchema).max(200),
  steps: z.array(StepSchema).max(200),
})
export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>

function describe(error: z.ZodError) {
  const issue = error.issues[0]
  const where = issue?.path.join(".")
  return where ? `${where}: ${issue?.message}` : (issue?.message ?? "unknown")
}

/**
 * Checks what the AI answered. Fails with a readable message when it does not
 * fit the recipe schema, or when the AI says there is no recipe.
 */
export function readExtractedRecipe(raw: unknown): ExtractedRecipe {
  if (raw && typeof raw === "object" && "error" in raw && !("title" in raw)) {
    throw new ExtractionError(
      "no_recipe_found",
      "No recipe was found in that. Check that the link, photo or text really contains one."
    )
  }
  const prepared =
    raw && typeof raw === "object"
      ? {
          ...raw,
          ...(Array.isArray((raw as { tags?: unknown }).tags)
            ? // Only tags from the list stay; anything else the AI wrote is dropped.
              { tags: fitTags((raw as { tags: unknown[] }).tags) }
            : {}),
          // The AI writes units as the material does: fit them to our list.
          ...("ingredients" in raw
            ? { ingredients: fitIngredientUnits(raw.ingredients) }
            : {}),
        }
      : raw
  const result = ExtractedRecipeSchema.safeParse(prepared)
  if (!result.success) {
    throw new ExtractionError(
      "invalid_recipe",
      `The AI's answer is not a valid recipe (${describe(result.error)}). Try again, or use a different parsing model.`
    )
  }
  const recipe = result.data
  if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
    throw new ExtractionError(
      "no_recipe_found",
      "No recipe was found in that. Check that the link, photo or text really contains one."
    )
  }
  return recipe
}

/**
 * Adds the source and empty nutrition. When the source does not say how many
 * servings the recipe makes, it is 1: we do not guess a number.
 */
export function toRecipeContent(
  recipe: ExtractedRecipe,
  source: Source
): RecipeContent {
  return RecipeContentSchema.parse({
    ...recipe,
    servings: recipe.servings ?? 1,
    nutrition: emptyNutrition,
    source,
  })
}
