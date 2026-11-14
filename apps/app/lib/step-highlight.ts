import { quantityPattern } from "@workspace/schemas"

/**
 * Finds the parts of a recipe step that are shown in bold: the recipe's own
 * ingredients, amounts with their unit and times. Plain text matching, no AI.
 * The step text itself is never changed; this only says which parts are bold.
 */

/** The words that make an amount or a time, per language (see `stepWords` in common.json). */
export type StepVocabulary = {
  /** Unit words: "g", "tbsp", "cups", "EL", "Tassen". */
  units: string[]
  /** Time words: "minutes", "min", "hour", "Stunden". */
  times: string[]
  /** Common food words ("oil", "Öl", "Nudel") that are bold even when the recipe lists them differently. */
  foods?: string[]
  /** Words in ingredient names that describe it ("fresh", "gemischt") and are not bold alone. */
  modifiers?: string[]
}

export type StepPiece = { text: string; bold: boolean }

type Kind = "ingredient" | "amount" | "time" | "counted"
type Span = { start: number; end: number; kind: Kind }

// Letters and digits of the supported languages, so "flour" is not found in "flourish".
const wordChars = "A-Za-z0-9\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF\\u0100-\\u017F"
/** Punctuation around a word, like the comma in "flour,". */
const edges = new RegExp(`^[^${wordChars}]+|[^${wordChars}]+$`, "g")
const before =`(?<![${wordChars}])`
const after = `(?![${wordChars}])`

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const spaced = (text: string) =>
  text.trim().split(/\s+/).map(escape).join("\\s+")

const range = `${quantityPattern}(?:\\s*(?:-|–|to)\\s*${quantityPattern})?`

/** An alternation of words, longest first so "fl oz" wins over "fl". */
function anyOf(words: string[]) {
  const unique = [...new Set(words.map((word) => word.trim()).filter(Boolean))]
  if (unique.length === 0) return null
  unique.sort((a, b) => b.length - a.length)
  return unique.map(spaced).join("|")
}

/** Endings that make a plural or singular: "egg" / "eggs", "tomato" / "tomatoes", "Tomate" / "Tomaten". */
const endings = "(?:s|es|n|en|e)?"

/** One word of an ingredient name, matching its singular and plural. */
function wordPattern(word: string) {
  const lower = word.toLowerCase()
  if (lower.length > 3 && lower.endsWith("ies")) {
    return `${escape(word.slice(0, -3))}(?:y|ies)`
  }
  if (lower.length > 3 && lower.endsWith("y")) {
    return `${escape(word.slice(0, -1))}(?:y|ies)`
  }
  const stem = lower.length > 3 ? word.replace(/(?:es|en|s|n|e)$/i, "") : word
  return `${escape(stem.length >= 3 ? stem : word)}${endings}`
}

/** The name of an ingredient without brackets: "butter (soft)" becomes "butter". */
function cleanName(name: string) {
  return name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * What can be bold for the ingredient names: each full name, and each main word
 * of a longer name ("Hackfleisch gemischt" also gives "Hackfleisch"), without
 * describing words such as "fresh" or "gemischt".
 */
function nameParts(names: string[], modifiers: string[]) {
  const skip = new Set(modifiers.map((word) => word.trim().toLowerCase()))
  const parts: string[] = []
  for (const name of names.map(cleanName)) {
    parts.push(name)
    const words = name.split(" ").map((word) => word.replace(edges, ""))
    if (words.length < 2) continue
    for (const word of words) {
      if (word.length >= 4 && !skip.has(word.toLowerCase())) parts.push(word)
    }
  }
  return parts
}

function ingredientPattern(names: string[]) {
  const seen = new Set<string>()
  const cleaned = names
    .filter((name) => name.length >= 2)
    .filter((name) => {
      const key = name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    // Longest first: "olive oil" is found as a whole, not just "oil".
    .sort((a, b) => b.length - a.length)
  if (cleaned.length === 0) return null
  return cleaned
    .map((name) => name.split(" ").map(wordPattern).join("\\s+"))
    .join("|")
}

function scan(text: string, pattern: string | null, kind: Kind, spans: Span[]) {
  if (!pattern) return
  for (const match of text.matchAll(new RegExp(pattern, "gi"))) {
    spans.push({ start: match.index, end: match.index + match[0].length, kind })
  }
}

/** Splits a step into pieces, each either bold or normal. */
export function highlightStep(
  text: string,
  ingredientNames: string[],
  vocabulary: StepVocabulary
): StepPiece[] {
  const ingredients = ingredientPattern([
    ...nameParts(ingredientNames, vocabulary.modifiers ?? []),
    ...(vocabulary.foods ?? []),
  ])
  const units = anyOf(vocabulary.units)
  const times = anyOf(vocabulary.times)

  const spans: Span[] = []
  scan(text, ingredients && `${before}(?:${ingredients})${after}`, "ingredient", spans)
  // "2 eggs": a number straight before an ingredient counts as its amount.
  scan(
    text,
    ingredients && `${before}${range}\\s*(?:${ingredients})${after}`,
    "counted",
    spans
  )
  scan(text, units && `${before}${range}\\s*(?:${units})${after}`, "amount", spans)
  scan(text, times && `${before}${range}\\s*-?\\s*(?:${times})${after}`, "time", spans)

  // Overlaps: the earlier match wins, and at the same start the longer one.
  spans.sort((a, b) => a.start - b.start || b.end - a.end)
  const chosen: Span[] = []
  for (const span of spans) {
    const last = chosen[chosen.length - 1]
    if (!last || span.start >= last.end) chosen.push({ ...span })
  }

  // "200 g" + "flour" is one piece, and so is "1 hour" + "30 minutes".
  const merged: Span[] = []
  for (const span of chosen) {
    const last = merged[merged.length - 1]
    if (last) {
      const gap = text.slice(last.end, span.start)
      const amountThenIngredient =
        last.kind === "amount" && span.kind === "ingredient" && /^\s+$/.test(gap)
      const timeThenTime =
        last.kind === "time" &&
        span.kind === "time" &&
        /^(?:\s+|\s*,\s*|\s+(?:and|und|y|et|e)\s+)$/i.test(gap)
      if (amountThenIngredient || timeThenTime) {
        last.end = span.end
        if (amountThenIngredient) last.kind = "counted"
        continue
      }
    }
    merged.push(span)
  }

  const pieces: StepPiece[] = []
  let position = 0
  for (const span of merged) {
    if (span.start > position) {
      pieces.push({ text: text.slice(position, span.start), bold: false })
    }
    pieces.push({ text: text.slice(span.start, span.end), bold: true })
    position = span.end
  }
  if (position < text.length) {
    pieces.push({ text: text.slice(position), bold: false })
  }
  return pieces
}
