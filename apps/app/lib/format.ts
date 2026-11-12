import type { UnitSystem } from "@workspace/schemas"

export { formatAmount } from "@workspace/schemas"

/** Metric (g, ml) or imperial (oz, cups). */
export type Units = UnitSystem

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
