import { parseQuantity } from "./quantity.js"
import { sortTags, TagsSchema, type TagKey } from "./tags.js"
import { arrangeSections } from "./sections.js"
import { isUnitKey } from "./units.js"
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
  /** Tags from the list (see `tagKeys`). */
  tags: TagKey[]
  calories: string
  protein: string
  carbs: string
  fat: string
  /** Set when the values were estimated by an AI. Kept while the recipe is edited. */
  nutritionEstimated?: boolean
  ingredients: {
    key: string
    quantity: string
    /** A unit key from the list (see `unitKeys`), or "" for no unit. */
    unit: string
    name: string
    note: string
    /** The `key` of a section in `sections`, or "" for no section. */
    sectionKey: string
  }[]
  steps: { key: string; text: string; sectionKey: string }[]
  /**
   * The sections, in order. Optional: most recipes have none. Ingredients and
   * steps point to them with `sectionKey`.
   */
  sections: { key: string; name: string }[]
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
    tags: [],
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    ingredients: [
      { key: newKey(), quantity: "", unit: "", name: "", note: "", sectionKey: "" },
    ],
    steps: [{ key: newKey(), text: "", sectionKey: "" }],
    sections: [],
  }
}

const text = (value: number | null) => (value === null ? "" : String(value))

export function draftFromRecipe(
  recipe: DraftContent,
  newKey: () => string
): RecipeDraft {
  const sections: RecipeDraft["sections"] = []
  const keyOf = (name: string | null | undefined) => {
    const trimmed = name?.trim()
    if (!trimmed) return ""
    let found = sections.find((s) => s.name === trimmed)
    if (!found) {
      found = { key: newKey(), name: trimmed }
      sections.push(found)
    }
    return found.key
  }
  const ingredients = recipe.ingredients.map((i) => ({
    key: newKey(),
    quantity: text(i.quantity),
    unit: i.unit ?? "",
    name: i.name,
    note: i.note ?? "",
    sectionKey: keyOf(i.section),
  }))
  const steps = recipe.steps.map((s) => ({
    key: newKey(),
    text: s.text,
    sectionKey: keyOf(s.section),
  }))
  return {
    title: recipe.title,
    description: recipe.description,
    servings: String(recipe.servings),
    prepMinutes: text(recipe.prepMinutes),
    cookMinutes: text(recipe.cookMinutes),
    tags: [...recipe.tags],
    calories: text(recipe.nutrition.calories),
    protein: text(recipe.nutrition.protein),
    carbs: text(recipe.nutrition.carbs),
    fat: text(recipe.nutrition.fat),
    ...(recipe.nutrition.estimated ? { nutritionEstimated: true } : {}),
    ingredients,
    steps,
    sections,
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
    ...(draft.nutritionEstimated ? { estimated: true } : {}),
  }

  // Sections: empty ones are dropped, and one with rows needs a name.
  const sectionName = (sectionKey: string) => {
    const section = draft.sections.find((s) => s.key === sectionKey)
    const name = section?.name.trim()
    return name || null
  }
  const used = new Set(
    [...draft.ingredients, ...draft.steps]
      .filter((row) => ("name" in row ? row.name.trim() : row.text.trim()))
      .map((row) => row.sectionKey)
      .filter(Boolean)
  )
  for (const section of draft.sections) {
    if (used.has(section.key) && !section.name.trim()) {
      errors[`section.${section.key}.name`] = "Give the section a name."
    }
  }
  // Rows without a section first, then each section in its order.
  const bySection = <T extends { sectionKey: string }>(rows: T[]) => [
    ...rows.filter((row) => !sectionName(row.sectionKey)),
    ...draft.sections.flatMap((section) =>
      rows.filter((row) => row.sectionKey === section.key && sectionName(row.sectionKey))
    ),
  ]

  // Without a section the field is left out, so a plain recipe stays as it was.
  const sectionOf = (sectionKey: string) => {
    const section = sectionName(sectionKey)
    return section ? { section } : {}
  }

  const ingredients: DraftContent["ingredients"] = []
  for (const row of bySection(draft.ingredients)) {
    const name = row.name.trim()
    const unit = row.unit.trim()
    if (unit && !isUnitKey(unit)) {
      errors[`ingredient.${row.key}.unit`] = "Choose a unit from the list."
    }
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
      unit: isUnitKey(unit) ? unit : null,
      note: note || null,
      ...sectionOf(row.sectionKey),
    })
  }

  const steps = bySection(draft.steps)
    .map((s) => ({ text: s.text.trim(), ...sectionOf(s.sectionKey) }))
    .filter((s) => s.text)

  const parsedTags = TagsSchema.safeParse(draft.tags)
  if (!parsedTags.success) errors.tags = "Choose tags from the list."
  const tags = parsedTags.success ? sortTags(parsedTags.data) : []

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
      ingredients: arrangeSections(ingredients),
      steps: arrangeSections(steps),
      nutrition,
    },
  }
}
