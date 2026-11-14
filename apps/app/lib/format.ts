import {
  amountParts,
  type UnitKey,
  type UnitSystem,
} from "@workspace/schemas"

import i18n from "@/lib/i18n"

/** Metric (g, ml) or imperial (oz, cups). */
export type Units = UnitSystem

/** "45 min" or "1 h 30 min", with the unit names of the current language. */
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (minutes < 60) return i18n.t("common:minutes", { count: minutes })
  return m
    ? i18n.t("common:hoursMinutes", { hours: h, minutes: m })
    : i18n.t("common:hours", { count: h })
}

/** A number written the way the current language writes it ("1,5" or "1.5"). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(i18n.language, options).format(value)
}

/** The name of a unit in the current language: "EL" in German, "tbsp" in English. */
export function unitName(unit: UnitKey, count = 2) {
  return i18n.t(`common:units.${unit}`, { count })
}

/**
 * An amount as text ("200 g", "1,5 Tassen"), scaled by `factor`, in the chosen
 * unit system. The numbers and the names of the units follow the current
 * language. Returns null when the source gave no amount.
 */
export function formatAmount(
  amount: { quantity: number | null; unit: UnitKey | null },
  factor = 1,
  system: Units = "metric"
) {
  const parts = amountParts(amount, factor, system)
  if (!parts) return null
  const decimal = formatNumber(1.5).charAt(1)
  const number = parts.number.replace(".", decimal)
  return parts.unit ? `${number} ${unitName(parts.unit, parts.count)}` : number
}
