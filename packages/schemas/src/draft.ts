import { parseQuantity } from "./quantity.js"
import type { RecipeContent } from "./recipe.js"

/**
 * A recipe while someone is typing it: every field is the text in an input.
 * `readDraft` turns it into a recipe, or says what to fix.
 */
export type RecipeDraft = {
  title: string
  description: string
  servings: string
  prepMinutes: string
  cookMinutes: string
  /** Separated by commas. */
  tags: string
  calories: string
  protein: string
  carbs: string
  fat: string
  ingredients: {
    key: string
    quantity: string
    unit: string
    name: string
    note: string
  }[]
  steps: { key: string; text: string }[]
}

export type DraftContent = Omit<RecipeContent, "source">

/** A new, empty form. `newKey` gives each row an id for the list. */
export function emptyDraft(newKey: () => string): RecipeDraft {
  return {
    title: "",
    description: "",
    servings: "4",
    prepMinutes: "",
    cookMinutes: "",
    tags: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    ingredients: [
      { key: newKey(), quantity: "", unit: "", name: "", note: "" },
    ],
    steps: [{ key: newKey(), text: "" }],
  }
}

const text = (value: number | null) => (value === null ? "" : String(value))

export function draftFromRecipe(
  recipe: DraftContent,
  newKey: () => string
): RecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: String(recipe.servings),
    prepMinutes: text(recipe.prepMinutes),
    cookMinutes: text(recipe.cookMinutes),
    tags: recipe.tags.join(", "),
    calories: text(recipe.nutrition.calories),
    protein: text(recipe.nutrition.protein),
    carbs: text(recipe.nutrition.carbs),
    fat: text(recipe.nutrition.fat),
    ingredients: recipe.ingredients.map((i) => ({
      key: newKey(),
      quantity: text(i.quantity),
      unit: i.unit ?? "",
      name: i.name,
      note: i.note ?? "",
    })),
    steps: recipe.steps.map((s) => ({ key: newKey(), text: s.text })),
  }
}

export type DraftResult =
  | { ok: true; content: DraftContent }
  | {
      ok: false
      /** Messages by field: "title", "servings", "ingredient.<key>.quantity", … */
      errors: Record<string, string>
    }

function wholeNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined
}

function decimal(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^\d+(?:[.,]\d+)?$/.test(trimmed)
    ? Number(trimmed.replace(",", "."))
    : undefined
}

/**
 * Checks a draft. Empty ingredient and step rows are dropped. An empty amount
 * becomes `null`: we never put a number the person did not type.
 */
export function readDraft(draft: RecipeDraft): DraftResult {
  const errors: Record<string, string> = {}

  const title = draft.title.trim()
  if (!title) errors.title = "Give the recipe a title."

  const servings = wholeNumber(draft.servings)
  if (servings === null || servings === undefined || servings < 1) {
    errors.servings = "Enter a whole number of servings, 1 or more."
  }

  const minutes = (field: "prepMinutes" | "cookMinutes") => {
    const value = wholeNumber(draft[field])
    if (value === undefined) errors[field] = "Enter whole minutes, like 30."
    return value ?? null
  }
  const prepMinutes = minutes("prepMinutes")
  const cookMinutes = minutes("cookMinutes")

  const nutrient = (field: "calories" | "protein" | "carbs" | "fat") => {
    const value = decimal(draft[field])
    if (value === undefined) errors[field] = "Enter a number, like 12.5."
    return value ?? null
  }
  const nutrition = {
    calories: nutrient("calories"),
    protein: nutrient("protein"),
    carbs: nutrient("carbs"),
    fat: nutrient("fat"),
  }

  const ingredients: DraftContent["ingredients"] = []
  for (const row of draft.ingredients) {
    const name = row.name.trim()
    const unit = row.unit.trim()
    const note = row.note.trim()
    const amount = row.quantity.trim()
    if (!name && !unit && !note && !amount) continue
    const quantity = parseQuantity(amount)
    if (quantity === undefined) {
      errors[`ingredient.${row.key}.quantity`] =
        "Enter a number like 2, 1.5 or 1/2, or leave it empty."
    }
    if (!name) errors[`ingredient.${row.key}.name`] = "Add the ingredient's name."
    ingredients.push({
      name,
      quantity: quantity ?? null,
      unit: unit || null,
      note: note || null,
    })
  }

  const steps = draft.steps
    .map((s) => s.text.trim())
    .filter(Boolean)
    .map((t) => ({ text: t }))

  const seen = new Set<string>()
  const tags = draft.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase()
      if (!tag || seen.has(key)) return false
      seen.add(key)
      return true
    })

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    content: {
      title,
      description: draft.description.trim(),
      servings: servings!,
      prepMinutes,
      cookMinutes,
      tags,
      ingredients,
      steps,
      nutrition,
    },
  }
}
