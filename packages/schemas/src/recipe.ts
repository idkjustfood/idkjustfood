import { z } from "zod"

import { TagsSchema } from "./tags.js"
import { fitUnit, UnitSchema } from "./units.js"

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

/**
 * The headline of a part of a recipe, for example "Sauce" or "Dough". Sections
 * are optional: an ingredient or step without one (empty or left out) belongs to
 * no part, and a recipe without any sections is shown as one plain list.
 */
export const SectionNameSchema = z.string().trim().min(1).max(100)

export const IngredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Empty (null) when the source does not say. Never guessed. */
  quantity: z.number().positive().nullable(),
  /** One of the fixed list of units (see `unitKeys`), or empty (null) for "no unit". */
  unit: UnitSchema.nullable(),
  note: z.string().trim().min(1).max(300).nullable(),
  /** The part of the recipe this belongs to. Empty or left out: no section. */
  section: SectionNameSchema.nullable().optional(),
})
export type Ingredient = z.infer<typeof IngredientSchema>

/**
 * Makes the units of ingredients from outside (an AI answer, a web page, a file
 * someone imports) fit the list of units, see `fitUnit`. Anything that is not a
 * list of ingredients is returned as it is, so the schema can report it.
 */
export function fitIngredientUnits(ingredients: unknown): unknown {
  if (!Array.isArray(ingredients)) return ingredients
  return ingredients.map((item) => {
    if (!item || typeof item !== "object" || !("unit" in item)) return item
    const row = item as { unit?: unknown; note?: unknown }
    if (row.unit !== null && typeof row.unit !== "string") return item
    const note = typeof row.note === "string" ? row.note : null
    return { ...row, ...fitUnit(row.unit as string | null, note) }
  })
}

/** A timer is not stored: it is found in the text, see `findTimers`. */
export const StepSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  /** The part of the recipe this belongs to. Empty or left out: no section. */
  section: SectionNameSchema.nullable().optional(),
})
export type Step = z.infer<typeof StepSchema>

/** Per serving. Empty (null) values are not shown anywhere. */
export const NutritionSchema = z.object({
  calories: z.number().min(0).max(100_000).nullable(),
  protein: z.number().min(0).max(10_000).nullable(),
  carbs: z.number().min(0).max(10_000).nullable(),
  fat: z.number().min(0).max(10_000).nullable(),
  /** True when an AI estimated the values from the ingredients. Absent for values a person entered. */
  estimated: z.boolean().optional(),
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
  /** Only tags from the fixed list (see `tagKeys`), in its order. */
  tags: TagsSchema,
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
