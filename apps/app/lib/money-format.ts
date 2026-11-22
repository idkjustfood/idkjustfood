import type { Currency } from "@workspace/schemas"

import i18n from "@/lib/i18n"

/** "€12.50" or "12,50 €": an amount in cents, written the way the current language writes it. */
export function formatMoney(cents: number, currency: Currency) {
  return new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency,
  }).format(cents / 100)
}

/**
 * The text to put in an amount field when editing an amount: "12.5" or "12,5" in the decimal
 * mark of the current language, without a currency sign or thousands separators.
 */
export function amountInputText(cents: number) {
  const mark = new Intl.NumberFormat(i18n.language).format(1.5).charAt(1)
  const whole = Math.trunc(cents / 100)
  const fraction = cents % 100
  return fraction === 0
    ? String(whole)
    : `${whole}${mark}${String(fraction).padStart(2, "0").replace(/0$/, "")}`
}

/** "21 Nov": a short label for a day (`YYYY-MM-DD`). */
export function shortDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}
