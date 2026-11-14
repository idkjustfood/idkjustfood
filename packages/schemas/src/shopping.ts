import { z } from "zod"

import { RecipeLanguageSchema } from "./language.js"
import type { Ingredient } from "./recipe.js"
import { UnitSchema, unitKey } from "./units.js"

const name = z.string().trim().min(1).max(200)
const quantity = z.number().positive().max(1_000_000).nullable()
const unit = UnitSchema.nullable()
const note = z.string().trim().min(1).max(300).nullable()

/** What an item on a shopping list is. The quantity is empty when nobody said how much. */
export const ShoppingItemContentSchema = z.object({
  name,
  quantity,
  unit,
  note,
  checked: z.boolean(),
  /** Titles of the recipes the item came from. Empty for items typed in by hand. */
  fromRecipes: z.array(z.string().max(200)).max(100),
})
export type ShoppingItemContent = z.infer<typeof ShoppingItemContentSchema>

/**
 * What a client sends to add an item by hand. The client may choose the `id`
 * (a UUID), so an item made offline keeps its id and sending it twice is harmless.
 */
export const ShoppingItemInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name,
  quantity: quantity.optional(),
  unit: unit.optional(),
  note: note.optional(),
})
export type ShoppingItemInput = z.infer<typeof ShoppingItemInputSchema>

/** A change to one item. Only the fields that are sent change. */
export const ShoppingItemUpdateSchema = z.object({
  name: name.optional(),
  quantity: quantity.optional(),
  unit: unit.optional(),
  note: note.optional(),
  checked: z.boolean().optional(),
})
export type ShoppingItemUpdate = z.infer<typeof ShoppingItemUpdateSchema>

export const ShoppingItemSchema = ShoppingItemContentSchema.extend({
  id: z.string(),
})
export type ShoppingItem = z.infer<typeof ShoppingItemSchema>

/** What a client sends to make a list. */
export const ShoppingListInputSchema = z.object({
  /** Chosen by the client, like for items. */
  id: z.string().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(100),
  /** The household to share the list with. Empty (null) means a personal list. */
  householdId: z.string().nullable().optional(),
})
export type ShoppingListInput = z.infer<typeof ShoppingListInputSchema>

export const ShoppingListRenameSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export const ShoppingListSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The household the list is shared with, or null for a personal list. */
  householdId: z.string().nullable(),
  /** Who made the list. */
  userId: z.string(),
  items: z.array(ShoppingItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ShoppingList = z.infer<typeof ShoppingListSchema>

/** What a client sends to add a recipe's ingredients to a list. */
export const AddRecipeToListSchema = z.object({
  recipeId: z.string().min(1),
  /** Scale the amounts to this many servings. Defaults to the recipe's own. */
  servings: z.number().int().min(1).max(1000).optional(),
  /** Used when the pantry has to be made first, to pick its default list. */
  language: RecipeLanguageSchema.optional(),
})
export type AddRecipeToList = z.infer<typeof AddRecipeToListSchema>

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/** Cuts floating point noise: 0.1 + 0.2 is 0.3, not 0.30000000000000004. */
const clean = (value: number) => Math.round(value * 10_000) / 10_000

/**
 * Whether a new line can be merged into an item: not ticked off yet, same name,
 * same unit, and both have an amount or both have none.
 */
export function canMerge(
  item: Pick<ShoppingItemContent, "name" | "quantity" | "unit" | "checked">,
  line: { name: string; quantity: number | null; unit: string | null }
) {
  return (
    !item.checked &&
    same(item.name, line.name) &&
    unitKey(item.unit) === unitKey(line.unit) &&
    (item.quantity === null) === (line.quantity === null)
  )
}

/** Adds two amounts without floating point noise. */
export function sumQuantity(a: number, b: number) {
  return clean(a + b)
}

/**
 * Puts a recipe's ingredients on a list and returns the new items. Identical
 * ingredients are merged: same name and the same unit add up (200 g + 100 g
 * flour is 300 g). Different units stay on separate lines, because converting
 * them (cups to grams) would be a guess. An ingredient without an amount never
 * gets one, and never changes the amount of another line. Items already ticked
 * off stay as they are.
 *
 * `factor` scales every amount (for example servings / recipe servings).
 */
export function addIngredients(
  items: ShoppingItemContent[],
  ingredients: Ingredient[],
  recipeTitle: string,
  factor = 1
): ShoppingItemContent[] {
  const result = items.map((item) => ({
    ...item,
    fromRecipes: [...item.fromRecipes],
  }))
  for (const ingredient of ingredients) {
    const amount =
      ingredient.quantity === null ? null : clean(ingredient.quantity * factor)
    const target = result.find((item) =>
      canMerge(item, {
        name: ingredient.name,
        quantity: amount,
        unit: ingredient.unit,
      })
    )
    if (target) {
      if (target.quantity !== null && amount !== null) {
        target.quantity = sumQuantity(target.quantity, amount)
      }
      if (!target.fromRecipes.includes(recipeTitle)) {
        target.fromRecipes.push(recipeTitle)
      }
    } else {
      result.push({
        name: ingredient.name,
        quantity: amount,
        unit: ingredient.unit,
        note: ingredient.note,
        checked: false,
        fromRecipes: [recipeTitle],
      })
    }
  }
  return result
}
