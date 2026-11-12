import { z } from "zod"

/** Where a recipe came from. Recipes typed in by hand are "manual". */
export const sourceKinds = [
  "manual",
  "video",
  "website",
  "photo",
  "text",
  "import",
] as const

export const SourceSchema = z.object({
  kind: z.enum(sourceKinds),
  /** Shown to people, for example "Instagram reel · @someone" or "example.com". */
  label: z.string().max(200).nullable(),
  url: z.string().max(2000).nullable(),
})
export type Source = z.infer<typeof SourceSchema>

export const manualSource: Source = { kind: "manual", label: null, url: null }

export const IngredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Empty (null) when the source does not say. Never guessed. */
  quantity: z.number().positive().nullable(),
  unit: z.string().trim().min(1).max(40).nullable(),
  note: z.string().trim().min(1).max(300).nullable(),
})
export type Ingredient = z.infer<typeof IngredientSchema>

/** A timer is not stored: it is found in the text, see `findTimers`. */
export const StepSchema = z.object({
  text: z.string().trim().min(1).max(2000),
})
export type Step = z.infer<typeof StepSchema>

/** Per serving. Empty (null) values are not shown anywhere. */
export const NutritionSchema = z.object({
  calories: z.number().min(0).max(100_000).nullable(),
  protein: z.number().min(0).max(10_000).nullable(),
  carbs: z.number().min(0).max(10_000).nullable(),
  fat: z.number().min(0).max(10_000).nullable(),
})
export type Nutrition = z.infer<typeof NutritionSchema>

export const emptyNutrition: Nutrition = {
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
}

const minutes = z.number().int().min(0).max(100_000).nullable()

/** What a recipe is, without ids and dates. Also the format of JSON export and import. */
export const RecipeContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  servings: z.number().int().min(1).max(1000),
  prepMinutes: minutes,
  cookMinutes: minutes,
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(40)
        .regex(/^[^,]+$/, "A tag can't contain a comma")
    )
    .max(30),
  ingredients: z.array(IngredientSchema).max(200),
  steps: z.array(StepSchema).max(200),
  nutrition: NutritionSchema,
  source: SourceSchema,
})
export type RecipeContent = z.infer<typeof RecipeContentSchema>

/** What a client sends to create or replace a recipe. */
export const RecipeInputSchema = RecipeContentSchema.extend({
  source: SourceSchema.optional(),
  /** The household to share the recipe with. Empty (null) means only you. */
  householdId: z.string().nullable().optional(),
})
export type RecipeInput = z.infer<typeof RecipeInputSchema>

/** A saved recipe, as the API returns it. */
export const RecipeSchema = RecipeContentSchema.extend({
  id: z.string(),
  /** The household it is shared with, or null when it is only yours. */
  householdId: z.string().nullable(),
  /** Who added the recipe. */
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Recipe = z.infer<typeof RecipeSchema>
