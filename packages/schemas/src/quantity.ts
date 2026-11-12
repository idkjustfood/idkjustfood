const unicodeFractions: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
}

const fractionChars = Object.keys(unicodeFractions).join("")

/** Matches "2", "1.5", "1,5", "1/2", "1 1/2", "½" and "1½". */
export const quantityPattern = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?[${fractionChars}]?|[${fractionChars}])`

/** The number in a text that already matched `quantityPattern`. */
export function quantityValue(text: string): number {
  const value = text.trim()
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(value)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const fraction = /^(\d+)\/(\d+)$/.exec(value)
  if (fraction) return Number(fraction[1]) / Number(fraction[2])
  const unicode = unicodeFractions[value.slice(-1)]
  if (unicode !== undefined) {
    const whole = value.slice(0, -1)
    return (whole ? Number(whole.replace(",", ".")) : 0) + unicode
  }
  return Number(value.replace(",", "."))
}

/**
 * Reads an amount typed by a person. Returns null for an empty text and
 * `undefined` when the text is not a positive number.
 */
export function parseQuantity(text: string): number | null | undefined {
  const value = text.trim()
  if (!value) return null
  if (!new RegExp(`^${quantityPattern}$`).test(value)) return undefined
  const result = quantityValue(value)
  return Number.isFinite(result) && result > 0 ? result : undefined
}

const nice: [number, string][] = [
  [0, ""],
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
  [1, ""],
]

/**
 * An amount as it reads in a kitchen: "1½", "¾", "12", "2.4".
 * Big numbers are rounded, small ones use a fraction when one is close enough.
 */
export function formatQuantity(value: number): string {
  if (value >= 100) return String(Math.round(value))
  if (value >= 10) {
    const half = Math.round(value * 2) / 2
    return Number.isInteger(half) ? String(half) : `${Math.floor(half)}½`
  }
  const whole = Math.floor(value)
  const rest = value - whole
  const closest = nice.reduce((a, b) =>
    Math.abs(b[0] - rest) < Math.abs(a[0] - rest) ? b : a
  )
  if (Math.abs(closest[0] - rest) <= 0.06) {
    const total = whole + (closest[0] === 1 ? 1 : 0)
    if (!total && !closest[1]) return "0"
    return `${total || ""}${closest[1]}`
  }
  const rounded = Math.round(value * 10) / 10
  return rounded === 0 ? String(Math.round(value * 100) / 100) : String(rounded)
}
