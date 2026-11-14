import { z } from "zod"

import {
  parseQuantity,
  quantityPattern,
  quantityValue,
} from "./quantity.js"
import {
  emptyNutrition,
  fitIngredientUnits,
  RecipeContentSchema,
  type Ingredient,
  type Nutrition,
  type RecipeContent,
} from "./recipe.js"
import { knownUnitWords, normalizeUnit, unitLabelEn } from "./units.js"

/** The parts of a recipe that export and import care about. */
type Exportable = Omit<RecipeContent, "source"> & { source?: unknown }

/** "400 g Penne, cut into strips" or "Salt" when no amount is given. */
export function ingredientLine(ingredient: Ingredient) {
  const amount =
    ingredient.quantity === null ? "" : formatExactQuantity(ingredient.quantity)
  const unit = ingredient.unit ? unitLabelEn(ingredient.unit) : ""
  const parts = [amount, unit, ingredient.name].filter(Boolean)
  const line = parts.join(" ")
  return ingredient.note ? `${line}, ${ingredient.note}` : line
}

/** Exact enough to read back: 0.5 stays "0.5", 1/3 becomes "0.333". */
function formatExactQuantity(value: number) {
  return String(Math.round(value * 1000) / 1000)
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export const jsonFormat = { app: "idkjustfood", version: 1 } as const

/** The recipe as JSON text. Reading it back gives the same recipe. */
export function toJson(recipe: Exportable) {
  const { title, description, servings, prepMinutes, cookMinutes } = recipe
  const { tags, ingredients, steps, nutrition } = recipe
  return JSON.stringify(
    {
      ...jsonFormat,
      title,
      description,
      servings,
      prepMinutes,
      cookMinutes,
      tags,
      ingredients,
      steps,
      nutrition,
    },
    null,
    2
  )
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function minutesText(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** The recipe as Markdown, to read, print or paste into a note. */
export function toMarkdown(recipe: Exportable) {
  const lines = [`# ${recipe.title}`, ""]
  if (recipe.description) lines.push(recipe.description, "")

  const facts = [`**Servings:** ${recipe.servings}`]
  if (recipe.prepMinutes !== null) {
    facts.push(`**Prep:** ${minutesText(recipe.prepMinutes)}`)
  }
  if (recipe.cookMinutes !== null) {
    facts.push(`**Cooking:** ${minutesText(recipe.cookMinutes)}`)
  }
  lines.push(facts.join(" · "), "")
  if (recipe.tags.length) lines.push(`**Tags:** ${recipe.tags.join(", ")}`, "")

  if (recipe.ingredients.length) {
    lines.push("## Ingredients", "")
    for (const ingredient of recipe.ingredients) {
      lines.push(`- ${ingredientLine(ingredient)}`)
    }
    lines.push("")
  }
  if (recipe.steps.length) {
    lines.push("## Steps", "")
    recipe.steps.forEach((step, i) => lines.push(`${i + 1}. ${step.text}`))
    lines.push("")
  }

  const nutrition = nutritionFacts(recipe.nutrition)
  if (nutrition.length) {
    lines.push("## Nutrition", "", "Per serving, an estimate:", "")
    for (const [label, value] of nutrition) lines.push(`- ${label}: ~${value}`)
    lines.push("")
  }
  return lines.join("\n").trimEnd() + "\n"
}

/** Only the values that are set, with their units. Empty values are left out. */
export function nutritionFacts(nutrition: Nutrition): [string, string][] {
  const facts: [string, string][] = []
  if (nutrition.calories !== null) {
    facts.push(["Calories", `${nutrition.calories} kcal`])
  }
  if (nutrition.protein !== null) {
    facts.push(["Protein", `${nutrition.protein} g`])
  }
  if (nutrition.carbs !== null) facts.push(["Carbs", `${nutrition.carbs} g`])
  if (nutrition.fat !== null) facts.push(["Fat", `${nutrition.fat} g`])
  return facts
}

// ---------------------------------------------------------------------------
// schema.org Recipe
// ---------------------------------------------------------------------------

/** The key that keeps our own ingredient structure inside a schema.org Recipe. */
const ingredientsKey = "x-idkjustfood-ingredients"

function isoDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `PT${h ? `${h}H` : ""}${m || !h ? `${m}M` : ""}`
}

/** The recipe as a schema.org Recipe object, the format recipe websites use. */
export function toSchemaOrg(recipe: Exportable): Record<string, unknown> {
  const nutrition = recipe.nutrition
  const info: Record<string, unknown> = { "@type": "NutritionInformation" }
  if (nutrition.calories !== null) info.calories = `${nutrition.calories} kcal`
  if (nutrition.protein !== null) info.proteinContent = `${nutrition.protein} g`
  if (nutrition.carbs !== null) {
    info.carbohydrateContent = `${nutrition.carbs} g`
  }
  if (nutrition.fat !== null) info.fatContent = `${nutrition.fat} g`

  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
  }
  if (recipe.description) out.description = recipe.description
  out.recipeYield = `${recipe.servings} servings`
  if (recipe.prepMinutes !== null) out.prepTime = isoDuration(recipe.prepMinutes)
  if (recipe.cookMinutes !== null) out.cookTime = isoDuration(recipe.cookMinutes)
  if (recipe.prepMinutes !== null || recipe.cookMinutes !== null) {
    out.totalTime = isoDuration(
      (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
    )
  }
  if (recipe.tags.length) out.keywords = recipe.tags.join(", ")
  out.recipeIngredient = recipe.ingredients.map(ingredientLine)
  out.recipeInstructions = recipe.steps.map((step) => ({
    "@type": "HowToStep",
    text: step.text,
  }))
  if (Object.keys(info).length > 1) out.nutrition = info
  // Other apps ignore this key. We use it to read the ingredients back exactly.
  out[ingredientsKey] = recipe.ingredients
  return out
}

const units = knownUnitWords
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|")
const lineStart = new RegExp(
  `^(${quantityPattern})(?:\\s*(?:-|–|to)\\s*${quantityPattern})?(?:\\s+(${units})(?![\\p{L}])\\.?)?\\s*(.*)$`,
  "iu"
)

/**
 * Reads one ingredient line like "2 cups flour, sifted". The amount stays empty
 * when the line starts with no number. We never guess one.
 */
export function parseIngredientLine(text: string): Ingredient | null {
  const line = text.replace(/\s+/g, " ").trim()
  if (!line) return null
  const match = lineStart.exec(line)
  let quantity: number | null = null
  let unit: Ingredient["unit"] = null
  let rest = line
  if (match && match[3]) {
    quantity = quantityValue(match[1]!)
    unit = normalizeUnit(match[2])
    rest = match[3]
  }
  const comma = rest.indexOf(",")
  const name = (comma === -1 ? rest : rest.slice(0, comma)).trim()
  const note = comma === -1 ? "" : rest.slice(comma + 1).trim()
  if (!name) return null
  return {
    name: name.slice(0, 200),
    quantity: quantity !== null && quantity > 0 ? quantity : null,
    unit,
    note: note ? note.slice(0, 300) : null,
  }
}

function text(value: unknown): string {
  if (typeof value === "string") return decodeEntities(value).trim()
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return text(value[0])
  return ""
}

function decodeEntities(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
}

function minutesFromDuration(value: unknown): number | null {
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(text(value))
  if (!match) return null
  const total =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0) +
    Math.round(Number(match[4] ?? 0) / 60)
  return total > 0 || match[0].length > 2 ? total : null
}

function servingsFrom(value: unknown): number {
  const raw = Array.isArray(value) ? value.map(text).join(" ") : text(value)
  const found = /\d+/.exec(raw)
  return found ? Math.max(1, Math.min(1000, Number(found[0]))) : 1
}

function steps(value: unknown): string[] {
  if (typeof value === "string") {
    return decodeEntities(value.replace(/<\/(?:p|li|div)>|<br\s*\/?>/gi, "\n"))
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (!Array.isArray(value)) {
    if (value && typeof value === "object") return steps([value])
    return []
  }
  return value.flatMap((item): string[] => {
    if (typeof item === "string") return steps(item)
    if (item && typeof item === "object") {
      const node = item as Record<string, unknown>
      if (Array.isArray(node.itemListElement)) return steps(node.itemListElement)
      return text(node.text ?? node.name) ? [text(node.text ?? node.name)] : []
    }
    return []
  })
}

function numberFrom(value: unknown): number | null {
  const found = /\d+(?:[.,]\d+)?/.exec(text(value))
  if (!found) return null
  const parsed = parseQuantity(found[0])
  return parsed ?? null
}

function nutritionFrom(value: unknown): Nutrition {
  if (!value || typeof value !== "object") return { ...emptyNutrition }
  const info = value as Record<string, unknown>
  return {
    calories: numberFrom(info.calories),
    protein: numberFrom(info.proteinContent),
    carbs: numberFrom(info.carbohydrateContent),
    fat: numberFrom(info.fatContent),
  }
}

function tagsFrom(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map(text) : text(value).split(",")
  return list.map((tag) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 30)
}

/** Finds the Recipe in JSON-LD: an object, a list, or an `@graph`. */
export function findSchemaOrgRecipe(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findSchemaOrgRecipe(item)
      if (found) return found
    }
    return null
  }
  if (!data || typeof data !== "object") return null
  const node = data as Record<string, unknown>
  const type = node["@type"]
  const types = Array.isArray(type) ? type : [type]
  if (types.includes("Recipe")) return node
  return node["@graph"] ? findSchemaOrgRecipe(node["@graph"]) : null
}

/** Reads a schema.org Recipe into our recipe. Returns null if it is not a usable recipe. */
export function fromSchemaOrg(data: unknown): RecipeContent | null {
  const node = findSchemaOrgRecipe(data)
  if (!node) return null

  let ingredients: Ingredient[] | null = null
  const own = z.array(RecipeContentSchema.shape.ingredients.element).safeParse(
    fitIngredientUnits(node[ingredientsKey])
  )
  const lines: unknown[] = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient
    : node.recipeIngredient
      ? [node.recipeIngredient]
      : []
  // Our own structure is only used when it still matches the visible lines.
  if (own.success && own.data.length === lines.length) {
    ingredients = own.data
  } else {
    ingredients = lines
      .map((line) => parseIngredientLine(text(line)))
      .filter((i): i is Ingredient => i !== null)
  }

  const result = RecipeContentSchema.safeParse({
    title: text(node.name).slice(0, 200),
    description: text(node.description).slice(0, 2000),
    servings: servingsFrom(node.recipeYield),
    prepMinutes: minutesFromDuration(node.prepTime),
    cookMinutes: minutesFromDuration(node.cookTime),
    tags: tagsFrom(node.keywords),
    ingredients,
    steps: steps(node.recipeInstructions).map((t) => ({ text: t.slice(0, 2000) })),
    nutrition: nutritionFrom(node.nutrition),
    source: { kind: "import", label: null, url: null },
  })
  return result.success ? result.data : null
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportResult =
  | { ok: true; recipe: RecipeContent }
  | { ok: false; error: string }

/**
 * Reads pasted or loaded text: our JSON export or a schema.org Recipe (also
 * inside a `<script type="application/ld+json">` tag).
 */
export function parseImport(input: string): ImportResult {
  let text = input.trim()
  const script = /<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/i.exec(text)
  if (script) text = script[1]!.trim()
  if (!text) return { ok: false, error: "There is nothing to import yet." }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: "This is not valid JSON." }
  }

  if (findSchemaOrgRecipe(data)) {
    const recipe = fromSchemaOrg(data)
    return recipe
      ? { ok: true, recipe }
      : { ok: false, error: "This schema.org recipe has no name." }
  }

  const prepared =
    data && typeof data === "object" && "ingredients" in data
      ? { ...data, ingredients: fitIngredientUnits(data.ingredients) }
      : data
  const result = RecipeContentSchema.omit({ source: true }).safeParse(prepared)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue?.path.join(".")
    return {
      ok: false,
      error: `This is not a recipe we can read${field ? ` (${field}: ${issue?.message})` : ""}.`,
    }
  }
  return {
    ok: true,
    recipe: { ...result.data, source: { kind: "import", label: null, url: null } },
  }
}
