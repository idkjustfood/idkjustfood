import { z } from "zod"

import { formatQuantity } from "./quantity.js"

export type UnitSystem = "metric" | "imperial"

/**
 * The units an ingredient can have. The key is what is stored and sent, in
 * every language; the app shows a translated label for each key. An
 * ingredient without a unit has `null` ("no unit").
 */
export const unitKeys = [
  "g",
  "kg",
  "mg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "fl_oz",
  "piece",
  "pinch",
  "clove",
  "bunch",
  "slice",
  "can",
  "pack",
] as const
export type UnitKey = (typeof unitKeys)[number]

export const UnitSchema = z.enum(unitKeys)

export function isUnitKey(value: unknown): value is UnitKey {
  return typeof value === "string" && (unitKeys as readonly string[]).includes(value)
}

/** How a unit reads in English: [one, many]. Other languages come from the app. */
const englishLabels: Record<UnitKey, [string, string]> = {
  g: ["g", "g"],
  kg: ["kg", "kg"],
  mg: ["mg", "mg"],
  ml: ["ml", "ml"],
  l: ["l", "l"],
  tsp: ["tsp", "tsp"],
  tbsp: ["tbsp", "tbsp"],
  cup: ["cup", "cups"],
  oz: ["oz", "oz"],
  lb: ["lb", "lb"],
  fl_oz: ["fl oz", "fl oz"],
  piece: ["piece", "pieces"],
  pinch: ["pinch", "pinches"],
  clove: ["clove", "cloves"],
  bunch: ["bunch", "bunches"],
  slice: ["slice", "slices"],
  can: ["can", "cans"],
  pack: ["pack", "packs"],
}

export function unitLabelEn(unit: UnitKey, count = 2) {
  return englishLabels[unit][count === 1 ? 0 : 1]
}

type UnitInfo = {
  kind: "mass" | "volume"
  system: UnitSystem | "both"
  /** How many grams (mass) or millilitres (volume) make one of this unit. */
  size: number
}

/** Units with a fixed size. The others (piece, pinch, …) are never converted. */
const units: Partial<Record<UnitKey, UnitInfo>> = {
  mg: { kind: "mass", system: "metric", size: 0.001 },
  g: { kind: "mass", system: "metric", size: 1 },
  kg: { kind: "mass", system: "metric", size: 1000 },
  oz: { kind: "mass", system: "imperial", size: 28.3495 },
  lb: { kind: "mass", system: "imperial", size: 453.592 },
  ml: { kind: "volume", system: "metric", size: 1 },
  l: { kind: "volume", system: "metric", size: 1000 },
  // Spoons are used in both systems, so they are never converted.
  tsp: { kind: "volume", system: "both", size: 4.92892 },
  tbsp: { kind: "volume", system: "both", size: 14.7868 },
  cup: { kind: "volume", system: "imperial", size: 236.588 },
  fl_oz: { kind: "volume", system: "imperial", size: 29.5735 },
}

/** Spellings people and sources use, in the app's languages, for each unit. */
const spellings: Record<UnitKey, string[]> = {
  g: ["g", "gr", "gram", "grams", "gramm", "gramo", "gramos", "gramme", "grammes", "grammo", "grammi"],
  kg: ["kg", "kilo", "kilos", "kilogram", "kilograms", "kilogramm", "kilogramo", "kilogramos", "kilogramme", "kilogrammes", "kilogrammo", "kilogrammi", "chilo", "chili", "chilogrammo", "chilogrammi"],
  mg: ["mg", "milligram", "milligrams", "milligramm", "miligramo", "miligramos", "milligramme", "milligrammes", "milligrammo", "milligrammi"],
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "mililitro", "mililitros", "millilitro", "millilitri"],
  l: ["l", "liter", "liters", "litre", "litres", "litro", "litros", "litri"],
  tsp: ["tsp", "teaspoon", "teaspoons", "tl", "teelöffel", "cucharadita", "cucharaditas", "cdta", "cuillère à café", "cuillères à café", "cuillere a cafe", "cucchiaino", "cucchiaini"],
  tbsp: ["tbsp", "tbs", "tablespoon", "tablespoons", "el", "esslöffel", "cucharada", "cucharadas", "cda", "cuillère à soupe", "cuillères à soupe", "cuillere a soupe", "cs", "cucchiaio", "cucchiai"],
  cup: ["cup", "cups", "tasse", "tassen", "tasses", "taza", "tazas", "tazza", "tazze"],
  oz: ["oz", "ounce", "ounces", "unze", "unzen", "onza", "onzas", "once", "onces", "oncia", "once"],
  lb: ["lb", "lbs", "pound", "pounds", "pfund", "libra", "libras", "livre", "livres", "libbra", "libbre"],
  fl_oz: ["fl oz", "fl. oz", "floz", "fl_oz", "fluid ounce", "fluid ounces"],
  piece: ["piece", "pieces", "pc", "pcs", "stk", "stück", "stueck", "pieza", "piezas", "pza", "pièce", "pièces", "piece", "pezzo", "pezzi"],
  pinch: ["pinch", "pinches", "prise", "prisen", "pizca", "pizcas", "pincée", "pincées", "pizzico"],
  clove: ["clove", "cloves", "zehe", "zehen", "diente", "dientes", "gousse", "gousses", "spicchio", "spicchi"],
  bunch: ["bunch", "bunches", "bund", "manojo", "manojos", "botte", "bottes", "bouquet", "mazzo", "mazzetto", "mazzi"],
  slice: ["slice", "slices", "scheibe", "scheiben", "rebanada", "rebanadas", "loncha", "lonchas", "tranche", "tranches", "fetta", "fette"],
  can: ["can", "cans", "dose", "dosen", "lata", "latas", "boîte", "boîtes", "boite", "boites", "scatola", "scatole"],
  pack: ["pack", "packs", "package", "packages", "packet", "packets", "pkg", "päckchen", "packung", "packungen", "paket", "pakete", "paquete", "paquetes", "paquet", "paquets", "sachet", "sachets", "confezione", "confezioni", "bustina", "bustine"],
}

/** The spelling as it is looked up: lower case, one space, no final full stop. */
export function unitSpelling(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "")
}

const aliases = new Map<string, UnitKey>()
for (const key of unitKeys) {
  for (const word of [key, ...spellings[key]]) aliases.set(word, key)
}

/** Every spelling we read, as `[spelling, key]`. The data migration is built from it. */
export const unitSpellings: [string, UnitKey][] = [...aliases]

/** Spellings of the units, for reading ingredient lines. */
export const knownUnitWords = [...aliases.keys()]

/**
 * The unit a spelling stands for: "grams", "Gramm" and "g" all give `g`,
 * "EL" and "tablespoons" give `tbsp`. Returns null when it is not in the list.
 */
export function normalizeUnit(text: string | null | undefined): UnitKey | null {
  if (!text) return null
  return aliases.get(unitSpelling(text)) ?? null
}

/**
 * Makes a unit from a source (an AI answer, a web page, an old recipe) fit the
 * list. When the unit is not in the list, the unit is dropped, the amount stays
 * and the original text goes into the note, so nothing is lost.
 */
export function fitUnit(
  unit: string | null | undefined,
  note: string | null | undefined
): { unit: UnitKey | null; note: string | null } {
  const text = typeof unit === "string" ? unit.trim() : ""
  const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null
  if (!text) return { unit: null, note: cleanNote }
  const key = normalizeUnit(text)
  if (key) return { unit: key, note: cleanNote }
  const joined = cleanNote ? `${text}, ${cleanNote}` : text
  return { unit: null, note: joined.slice(0, 300) }
}

function lookup(unit: UnitKey | null): UnitInfo | undefined {
  return unit ? units[unit] : undefined
}

/**
 * A unit as one comparable word: "grams" and "g" give the same key.
 * Text that is not a known unit is only lower-cased, so old lines still match.
 */
export function unitKey(unit: string | null): string | null {
  if (!unit || !unit.trim()) return null
  return normalizeUnit(unit) ?? unit.trim().toLowerCase()
}

export type Amount = { quantity: number | null; unit: string | null }

/** An amount ready to be written in any language: the number, the unit and how to pluralise it. */
export type AmountParts = {
  /** "1½", "300", written with a full stop as the decimal separator. */
  number: string
  unit: UnitKey | null
  /** 1 when the number reads as one ("1", "½"), otherwise 2. Picks "cup" or "cups". */
  count: 1 | 2
}

/** Rounds a metric amount the way a recipe would write it: 235 ml, not 236.6. */
function roundMetric(value: number) {
  return value >= 100 ? Math.round(value / 5) * 5 : Math.round(value)
}

function metricParts(value: number, base: "g" | "ml"): AmountParts {
  if (value >= 1000) {
    return part(`${Math.round(value / 10) / 100}`, base === "g" ? "kg" : "l")
  }
  return part(`${roundMetric(value)}`, base)
}

function imperialMass(grams: number): AmountParts {
  if (grams >= units.lb!.size) {
    return part(`${Math.round((grams / units.lb!.size) * 10) / 10}`, "lb")
  }
  return part(formatQuantity(grams / units.oz!.size), "oz")
}

function imperialVolume(ml: number): AmountParts {
  if (ml < units.tbsp!.size) {
    return part(formatQuantity(ml / units.tsp!.size), "tsp")
  }
  if (ml < units.cup!.size / 4) {
    return part(formatQuantity(ml / units.tbsp!.size), "tbsp")
  }
  return part(formatQuantity(ml / units.cup!.size), "cup")
}

const singular = ["1", "¼", "⅓", "½", "⅔", "¾", "⅛", "⅜", "⅝", "⅞"]

function part(number: string, unit: UnitKey | null): AmountParts {
  return { number, unit, count: singular.includes(number) ? 1 : 2 }
}

/**
 * Scales an amount by `factor` and converts it to the chosen system. Returns
 * null when the source gave no amount, so the screen can say so instead of
 * guessing. Units without a fixed size (piece, pinch, clove, …) are only scaled.
 */
export function amountParts(
  { quantity, unit }: { quantity: number | null; unit: UnitKey | null },
  factor = 1,
  system: UnitSystem = "metric"
): AmountParts | null {
  if (quantity === null) return null
  const value = quantity * factor
  const info = lookup(unit)

  if (!info) return part(formatQuantity(value), unit)
  if (info.system === "both" || info.system === system) {
    return part(formatQuantity(value), unit)
  }

  const base = value * info.size
  if (system === "metric") {
    return metricParts(base, info.kind === "mass" ? "g" : "ml")
  }
  return info.kind === "mass" ? imperialMass(base) : imperialVolume(base)
}

/** Like `amountParts`, written in English: "300 g", "1½ cups". */
export function formatAmount(
  amount: Amount,
  factor = 1,
  system: UnitSystem = "metric"
): string | null {
  const unit = normalizeUnit(amount.unit)
  const parts = amountParts({ quantity: amount.quantity, unit }, factor, system)
  if (!parts) return null
  return parts.unit
    ? `${parts.number} ${unitLabelEn(parts.unit, parts.count)}`
    : parts.number
}
