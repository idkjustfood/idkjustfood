import { formatQuantity } from "./quantity.js"

export type UnitSystem = "metric" | "imperial"

type UnitInfo = {
  /** Spelling shown to people. */
  label: string
  kind: "mass" | "volume"
  system: UnitSystem | "both"
  /** How many grams (mass) or millilitres (volume) make one of this unit. */
  size: number
}

const units: Record<string, UnitInfo> = {
  g: { label: "g", kind: "mass", system: "metric", size: 1 },
  kg: { label: "kg", kind: "mass", system: "metric", size: 1000 },
  oz: { label: "oz", kind: "mass", system: "imperial", size: 28.3495 },
  lb: { label: "lb", kind: "mass", system: "imperial", size: 453.592 },
  ml: { label: "ml", kind: "volume", system: "metric", size: 1 },
  l: { label: "l", kind: "volume", system: "metric", size: 1000 },
  // Spoons are used in both systems, so they are never converted.
  tsp: { label: "tsp", kind: "volume", system: "both", size: 4.92892 },
  tbsp: { label: "tbsp", kind: "volume", system: "both", size: 14.7868 },
  cup: { label: "cup", kind: "volume", system: "imperial", size: 236.588 },
}

const aliases: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
}

/** Spellings of the units we can convert, for reading ingredient lines. */
export const knownUnitWords = Object.keys(aliases)

function lookup(unit: string | null): UnitInfo | undefined {
  if (!unit) return undefined
  const key = aliases[unit.trim().toLowerCase().replace(/\.$/, "")]
  return key ? units[key] : undefined
}

/**
 * A unit as one comparable word: "grams" and "g" give the same key.
 * Units we don't know are only lower-cased, so "clove" and "Clove" match.
 */
export function unitKey(unit: string | null): string | null {
  if (!unit) return null
  const key = aliases[unit.trim().toLowerCase().replace(/\.$/, "")]
  return key ?? unit.trim().toLowerCase()
}

export type Amount = { quantity: number | null; unit: string | null }

/** Rounds a metric amount the way a recipe would write it: 235 ml, not 236.6. */
function roundMetric(value: number) {
  return value >= 100 ? Math.round(value / 5) * 5 : Math.round(value)
}

function metricText(value: number, base: "g" | "ml") {
  if (value >= 1000) {
    return `${Math.round(value / 10) / 100} ${base === "g" ? "kg" : "l"}`
  }
  return `${roundMetric(value)} ${base}`
}

function imperialMass(grams: number) {
  if (grams >= units.lb!.size) {
    return `${Math.round((grams / units.lb!.size) * 10) / 10} lb`
  }
  return `${formatQuantity(grams / units.oz!.size)} oz`
}

function imperialVolume(ml: number) {
  if (ml < units.tbsp!.size) {
    return `${formatQuantity(ml / units.tsp!.size)} tsp`
  }
  if (ml < units.cup!.size / 4) {
    return `${formatQuantity(ml / units.tbsp!.size)} tbsp`
  }
  return withCupWord(formatQuantity(ml / units.cup!.size))
}

const singleCup = ["1", "¼", "⅓", "½", "⅔", "¾", "⅛", "⅜", "⅝", "⅞"]

function withCupWord(number: string) {
  return `${number} ${singleCup.includes(number) ? "cup" : "cups"}`
}

/**
 * Turns an amount into text, scaled by `factor` and shown in the chosen system.
 * Returns null when the source gave no amount, so the screen can say so instead of guessing.
 * Units we don't know (cloves, handfuls, …) are only scaled, never converted.
 */
export function formatAmount(
  { quantity, unit }: Amount,
  factor = 1,
  system: UnitSystem = "metric"
): string | null {
  if (quantity === null) return null
  const value = quantity * factor
  const info = lookup(unit)

  if (!info) {
    const number = formatQuantity(value)
    return unit ? `${number} ${unit}` : number
  }

  if (info.system === "both" || info.system === system) {
    const number = formatQuantity(value)
    return info.label === "cup"
      ? withCupWord(number)
      : `${number} ${info.label}`
  }

  const base = value * info.size
  if (system === "metric") {
    return metricText(base, info.kind === "mass" ? "g" : "ml")
  }
  return info.kind === "mass" ? imperialMass(base) : imperialVolume(base)
}
