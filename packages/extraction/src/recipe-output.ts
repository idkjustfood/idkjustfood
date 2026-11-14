import { z } from "zod"

import {
  fitIngredientUnits,
  fitTags,
  IngredientSchema,
  RecipeContentSchema,
  StepSchema,
  TagsSchema,
  emptyNutrition,
  arrangeSections,
  type RecipeContent,
  type Source,
} from "@workspace/schemas"

import { ExtractionError } from "./errors.js"

const minutes = z.number().int().min(0).max(100_000).nullable()

/** A number, also when the model wrote it as text ("45 g", "12,5"). Anything else is empty. */
function nutrientNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const found = /\d+(?:[.,]\d+)?/.exec(value)
  return found ? Number(found[0].replace(",", ".")) : null
}

/** Reads the model's nutrition object; it may name the values a bit differently. */
function prepareNutrition(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const n = value as Record<string, unknown>
  const pick = (...names: string[]) => {
    for (const name of names) {
      const found = nutrientNumber(n[name])
      if (found !== null) return found
    }
    return null
  }
  return {
    calories: pick("calories", "kcal", "energy"),
    protein: pick("protein", "proteins"),
    carbs: pick("carbs", "carbohydrates", "carbohydrate", "carbs_g"),
    fat: pick("fat", "fats", "total_fat"),
  }
}

const nutrient = (max: number) =>
  z.number().min(0).max(max).nullable().catch(null).default(null)

/** The AI's estimate of the nutrition per serving. A value it cannot give stays empty. */
export const ExtractedNutritionSchema = z.object({
  calories: nutrient(100_000),
  protein: nutrient(10_000),
  carbs: nutrient(10_000),
  fat: nutrient(10_000),
})

/**
 * What the AI (or a web page's recipe data) gives us. It has no id, source or
 * nutrition (unless estimated): those are added by `toRecipeContent`. Servings may be empty.
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
  /**
   * Per serving, asked for from every AI-parsed recipe. Each value may be empty. Unusable values
   * never fail the recipe: they become empty.
   */
  nutrition: ExtractedNutritionSchema.optional(),
})
export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>

function describe(error: z.ZodError) {
  const issue = error.issues[0]
  const where = issue?.path.join(".")
  return where ? `${where}: ${issue?.message}` : (issue?.message ?? "unknown")
}

/**
 * Tidies the parts of a recipe. The items of one part are kept together, in the
 * order the parts appear. A recipe with only one part has no sections: a single
 * headline over everything tells the reader nothing.
 */
function withoutSingleSection(recipe: ExtractedRecipe): ExtractedRecipe {
  const items = [...recipe.ingredients, ...recipe.steps]
  const names = new Set(items.map((i) => i.section?.trim()).filter(Boolean))
  const single = names.size < 2 && items.every((i) => i.section?.trim())
  const clean = <T extends { section?: string | null }>(list: T[]) =>
    list.map(({ section: _section, ...rest }) => rest)
  if (single && names.size > 0) {
    return {
      ...recipe,
      ingredients: clean(recipe.ingredients),
      steps: clean(recipe.steps),
    }
  }
  return {
    ...recipe,
    ingredients: arrangeSections(recipe.ingredients),
    steps: arrangeSections(recipe.steps),
  }
}

/**
 * Phrases of a description that talks about the video or the recipe itself. The prompt forbids
 * them, and this drops them when a model writes one anyway.
 */
const aboutTheVideo =
  /\b(?:(?:in|on) (?:this|the) (?:video|reel|clip|short)|this (?:video|reel|clip) (?:shows?|explains?|is about)|this recipe (?:shows?|explains?|teaches|is about)|(?:im|in diesem) (?:video|reel)|(?:en|dans|in) (?:este|ce|questo) (?:v[ií]deo|reel)|cette recette (?:montre|explique)|esta receta (?:muestra|explica)|questa ricetta (?:mostra|spiega)|dieses rezept (?:zeigt|erklärt))\b/i

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
  const result = ExtractedRecipeSchema.safeParse(
    prepared && typeof prepared === "object" && "nutrition" in prepared
      ? {
          ...prepared,
          // An estimate that is not usable is dropped: it must never fail the recipe.
          nutrition: prepareNutrition(prepared.nutrition),
        }
      : prepared
  )
  if (!result.success) {
    throw new ExtractionError(
      "invalid_recipe",
      `The AI's answer is not a valid recipe (${describe(result.error)}). Try again, or use a different parsing model.`
    )
  }
  const recipe = withoutSingleSection({
    ...result.data,
    description: aboutTheVideo.test(result.data.description)
      ? ""
      : result.data.description,
  })
  if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
    throw new ExtractionError(
      "no_recipe_found",
      "No recipe was found in that. Check that the link, photo or text really contains one."
    )
  }
  return recipe
}

/**
 * Takes the words of a translated recipe and keeps everything else from the original:
 * amounts, units, tags, servings and times. So a translation can never change a number
 * or invent a detail. Fails when the translation lost or added an ingredient or a step.
 */
export function keepStructure(
  original: ExtractedRecipe,
  translated: ExtractedRecipe
): ExtractedRecipe {
  if (
    translated.ingredients.length !== original.ingredients.length ||
    translated.steps.length !== original.steps.length
  ) {
    throw new ExtractionError(
      "invalid_recipe",
      "The translation changed the number of ingredients or steps. Try again."
    )
  }
  // A section name is translated once, so its ingredients and steps keep the same headline.
  const names = new Map<string, string>()
  const sectionOf = (
    name: string | null | undefined,
    translatedName: string | null | undefined
  ) => {
    if (!name) return {}
    if (!names.has(name)) names.set(name, translatedName || name)
    return { section: names.get(name)! }
  }
  return {
    ...original,
    title: translated.title,
    description: original.description ? translated.description : "",
    ingredients: original.ingredients.map((ingredient, index) => ({
      ...ingredient,
      name: translated.ingredients[index]!.name,
      note: ingredient.note ? translated.ingredients[index]!.note : null,
      ...sectionOf(ingredient.section, translated.ingredients[index]!.section),
    })),
    steps: original.steps.map((step, index) => ({
      ...step,
      text: translated.steps[index]!.text,
      ...sectionOf(step.section, translated.steps[index]!.section),
    })),
  }
}

/**
 * Adds the source and nutrition. Nutrition is empty unless `estimate` is set (AI-parsed recipes): then
 * the AI's values are kept and marked as an estimate, or stay empty when it gave none.
 * When the source does not say how many servings the recipe makes, it is 1: we do not guess.
 */
export function toRecipeContent(
  recipe: ExtractedRecipe,
  source: Source,
  estimate = false
): RecipeContent {
  const { nutrition: estimated, ...rest } = recipe
  const values = estimate && estimated ? estimated : null
  const hasValue = !!values && Object.values(values).some((v) => v !== null)
  return RecipeContentSchema.parse({
    ...rest,
    servings: recipe.servings ?? 1,
    nutrition: hasValue ? { ...values, estimated: true } : emptyNutrition,
    source,
  })
}
