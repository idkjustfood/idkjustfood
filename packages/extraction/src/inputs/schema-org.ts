import {
  fitTags,
  fitUnit,
  knownUnitWords,
  quantityPattern,
  quantityValue,
} from "@workspace/schemas"

import {
  ExtractedRecipeSchema,
  type ExtractedRecipe,
} from "../recipe-output.js"

// Reads the schema.org Recipe data that most recipe websites put in their pages
// (a <script type="application/ld+json"> block). No AI is needed for these.

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
}

/** Replaces HTML entities (&amp;, &#39;, &#x27;) with their characters. */
export function decodeEntities(text: string) {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi,
    (match, code: string) => {
      if (code.startsWith("#x"))
        return safeChar(parseInt(code.slice(2), 16), match)
      if (code.startsWith("#"))
        return safeChar(parseInt(code.slice(1), 10), match)
      return entities[code.toLowerCase()] ?? match
    }
  )
}

function safeChar(code: number, fallback: string) {
  try {
    return String.fromCodePoint(code)
  } catch {
    return fallback
  }
}

/** Plain text of a value that may contain tags and entities. */
function plain(value: unknown): string {
  if (typeof value !== "string") return ""
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
}

/** Every JSON-LD value in a page. Blocks that are not valid JSON are skipped. */
export function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const pattern =
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(pattern)) {
    const body = (match[1] ?? "").trim().replace(/^<!\[CDATA\[|\]\]>$/g, "")
    try {
      blocks.push(JSON.parse(body))
    } catch {
      // Some sites have broken JSON-LD. The page text is still used.
    }
  }
  return blocks
}

function isRecipeNode(node: Record<string, unknown>) {
  const type = node["@type"]
  const types = Array.isArray(type) ? type : [type]
  return types.some((t) => typeof t === "string" && /(^|[/#:])Recipe$/i.test(t))
}

/** Finds Recipe objects anywhere in JSON-LD (also inside @graph and arrays). */
export function findRecipeNodes(
  value: unknown,
  found: Record<string, unknown>[] = []
) {
  if (Array.isArray(value)) {
    for (const item of value) findRecipeNodes(item, found)
  } else if (value && typeof value === "object") {
    const node = value as Record<string, unknown>
    if (isRecipeNode(node)) found.push(node)
    else for (const child of Object.values(node)) findRecipeNodes(child, found)
  }
  return found
}

/** "PT1H30M" or "P0DT45M" as whole minutes. Null when empty or not a duration. */
export function durationMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      value.trim()
    )
  if (!match) return null
  const [, d, h, m, s] = match
  const total =
    Number(d ?? 0) * 1440 +
    Number(h ?? 0) * 60 +
    Number(m ?? 0) +
    Math.round(Number(s ?? 0) / 60)
  return total > 0 ? total : null
}

/** The first whole number in a yield like "4 servings" or ["4", "4 servings"]. Null if none. */
export function yieldServings(value: unknown): number | null {
  const items = Array.isArray(value) ? value : [value]
  for (const item of items) {
    const text = typeof item === "number" ? String(item) : plain(item)
    const match = /\d+/.exec(text)
    if (match) {
      const count = Number(match[0])
      if (count >= 1 && count <= 1000) return count
    }
  }
  return null
}

const countUnits = [
  "clove",
  "cloves",
  "pinch",
  "pinches",
  "can",
  "cans",
  "bunch",
  "bunches",
  "slice",
  "slices",
  "piece",
  "pieces",
  "stick",
  "sticks",
  "sprig",
  "sprigs",
  "handful",
  "dash",
  "package",
  "packages",
]
const unitWords = [...knownUnitWords, ...countUnits].sort(
  (a, b) => b.length - a.length
)
const quantityStart = new RegExp(`^(${quantityPattern})(?![\\d/.,])`)
const rangeAfter = /^\s*(?:-|–|—|to)\s*(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/i
const unitStart = new RegExp(`^(${unitWords.join("|")})\\.?(?=\\s|$)`, "i")

/**
 * Splits "200 g flour, sifted" into amount, unit, name and note. The amount stays
 * empty when the line does not start with a clear number; ranges ("2-3") are kept
 * in the name instead of picking one number.
 */
export function parseIngredientLine(
  line: string
): ExtractedRecipe["ingredients"][number] {
  const text = plain(line)
  const whole = {
    name: text.slice(0, 200),
    quantity: null,
    unit: null,
    note: null,
  }
  const amount = quantityStart.exec(text)
  if (!amount) return splitNote(whole)

  let rest = text.slice(amount[0].length)
  if (rangeAfter.test(rest)) return splitNote(whole)
  const quantity = quantityValue(amount[1]!)
  if (!Number.isFinite(quantity) || quantity <= 0) return splitNote(whole)

  rest = rest.trim()
  let fitted: ReturnType<typeof fitUnit> = { unit: null, note: null }
  const unitMatch = unitStart.exec(rest)
  if (unitMatch) {
    // A unit that is not in our list ("handful") goes into the note.
    fitted = fitUnit(unitMatch[1]!.toLowerCase(), null)
    rest = rest.slice(unitMatch[0].length).trim()
  }
  rest = rest.replace(/^of\s+/i, "")
  const split = splitNote({
    name: rest.slice(0, 200) || text.slice(0, 200),
    quantity,
    unit: fitted.unit,
    note: null,
  })
  if (!fitted.note) return split
  return {
    ...split,
    note: (split.note ? `${fitted.note}, ${split.note}` : fitted.note).slice(
      0,
      300
    ),
  }
}

/** Moves a text after the first comma ("onion, finely chopped") into the note. */
function splitNote(item: ExtractedRecipe["ingredients"][number]) {
  const comma = item.name.indexOf(",")
  if (comma > 0 && comma < item.name.length - 1) {
    return {
      ...item,
      name: item.name.slice(0, comma).trim(),
      note:
        item.name
          .slice(comma + 1)
          .trim()
          .slice(0, 300) || null,
    }
  }
  return item
}

/** Instructions come as text, a list of text, steps, or sections of steps. */
function instructionTexts(value: unknown): string[] {
  if (typeof value === "string") {
    const html = value.replace(/<\/(?:li|p|div)>|<br\s*\/?>/gi, "\n")
    return plain(html.replace(/\n/g, "§"))
      .split("§")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (Array.isArray(value)) return value.flatMap(instructionTexts)
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>
    if (node.itemListElement) return instructionTexts(node.itemListElement)
    return instructionTexts(node.text ?? node.name)
  }
  return []
}

const dietNames: Record<string, string> = {
  vegetariandiet: "Vegetarian",
  vegandiet: "Vegan",
  glutenfreediet: "Gluten-free",
  lowcaloriediet: "Low calorie",
  lowfatdiet: "Low fat",
  lowlactosediet: "Low lactose",
  lowsaltdiet: "Low salt",
  diabeticdiet: "Diabetic",
  halaldiet: "Halal",
  kosherdiet: "Kosher",
  hindudiet: "Hindu",
}

function listOf(value: unknown): string[] {
  if (typeof value === "string")
    return value.split(",").map(plain).filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(listOf)
  return []
}

/** A list of text lines. Unlike `listOf`, a text is not split at commas. */
function lines(value: unknown): string[] {
  if (typeof value === "string") return [plain(value)].filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(lines)
  return []
}

/** Turns one schema.org Recipe object into our recipe parts. Missing things stay empty. */
export function recipeFromSchemaOrg(
  node: Record<string, unknown>
): Partial<ExtractedRecipe> {
  const tagSources = [
    ...listOf(node.recipeCuisine),
    ...listOf(node.suitableForDiet).map(
      (d) => dietNames[d.split("/").pop()!.toLowerCase()] ?? ""
    ),
    ...listOf(node.recipeCategory),
  ]
  const prepMinutes = durationMinutes(node.prepTime)
  let cookMinutes = durationMinutes(node.cookTime)
  const total = durationMinutes(node.totalTime)
  // A total without the parts is shown as cooking time, so the time is not lost.
  if (cookMinutes === null && prepMinutes === null && total !== null)
    cookMinutes = total

  return {
    title: plain(node.name).slice(0, 200),
    description: plain(node.description).slice(0, 2000),
    servings: yieldServings(node.recipeYield),
    prepMinutes,
    cookMinutes,
    tags: fitTags(tagSources),
    ingredients: lines(node.recipeIngredient ?? node.ingredients)
      .map(parseIngredientLine)
      .filter((i) => i.name),
    steps: instructionTexts(node.recipeInstructions).map((text) => ({
      text: text.slice(0, 2000),
    })),
  }
}

/** True when a page's recipe has everything we need to skip the AI. */
export function isComplete(
  recipe: Partial<ExtractedRecipe>
): recipe is ExtractedRecipe {
  return (
    ExtractedRecipeSchema.safeParse(recipe).success &&
    (recipe.ingredients?.length ?? 0) > 0 &&
    (recipe.steps?.length ?? 0) > 0
  )
}

/** The best Recipe in a page: the first one that is complete, else the first one. */
export function readPageRecipe(html: string): {
  complete?: ExtractedRecipe
  partial?: Record<string, unknown>
} {
  const nodes = jsonLdBlocks(html).flatMap((block) => findRecipeNodes(block))
  for (const node of nodes) {
    const recipe = recipeFromSchemaOrg(node)
    if (isComplete(recipe))
      return { complete: ExtractedRecipeSchema.parse(recipe) }
  }
  return { partial: nodes[0] }
}

/** The language a page says it is written in (the lang of its html tag), as written there. */
export function pageLanguage(html: string): string | undefined {
  const tag = /<html\b[^>]*>/i.exec(html)?.[0]
  const lang = tag && /\blang\s*=\s*["']?([a-zA-Z]{2,3})(?![a-zA-Z])/i.exec(tag)
  return lang?.[1]
}

/** The readable text of a page, without scripts and styles, cut to `maxChars`. */
export function htmlToText(html: string, maxChars = 20_000) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|template|head|nav|footer|iframe)\b[\s\S]*?<\/\1>/gi,
      " "
    )
    .replace(
      /<\/(?:p|div|li|h[1-6]|tr|section|article|ul|ol)>|<br\s*\/?>/gi,
      "\n"
    )
    .replace(/<[^>]+>/g, " ")
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars)
}

/** The page's own title, for a source label. */
export function pageTitle(html: string) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? plain(match[1]).slice(0, 200) : ""
}
