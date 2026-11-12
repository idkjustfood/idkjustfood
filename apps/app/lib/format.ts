export type Units = "metric" | "imperial"

type Amount = { quantity: number | null; unit: string | null }

const toImperial: Record<string, { unit: string; factor: number }> = {
  g: { unit: "oz", factor: 1 / 28.35 },
  kg: { unit: "lb", factor: 2.205 },
  ml: { unit: "cups", factor: 1 / 240 },
  l: { unit: "cups", factor: 4.227 },
}

function round(value: number) {
  if (value >= 10) return String(Math.round(value))
  // Halves and quarters read better in a kitchen than 0.33.
  const quarters = Math.round(value * 4) / 4
  if (quarters === 0) return String(Math.round(value * 100) / 100)
  const whole = Math.floor(quarters)
  const fraction =
    { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[quarters - whole] ?? ""
  if (!whole) return fraction
  return `${whole}${fraction}`
}

/**
 * Turns an amount into text, scaled by `factor` and shown in the chosen units.
 * Returns null when the source gave no amount, so the UI can say so instead of guessing.
 */
export function formatAmount(
  { quantity, unit }: Amount,
  factor = 1,
  units: Units = "metric"
): string | null {
  if (quantity === null) return null
  let value = quantity * factor
  let shownUnit = unit
  if (units === "imperial" && unit && toImperial[unit]) {
    value = value * toImperial[unit].factor
    shownUnit = toImperial[unit].unit
  }
  return shownUnit ? `${round(value)} ${shownUnit}` : round(value)
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
