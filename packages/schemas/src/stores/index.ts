import { aldi } from "./aldi.js"
import { standard } from "./standard.js"
import type { Supermarket } from "./supermarket.js"

export * from "./sections.js"
export * from "./supermarket.js"

/**
 * Every supermarket the app offers, in the order of the selection. To add one, make a file
 * next to `aldi.ts` and add it here. Nothing else changes.
 */
export const supermarkets: readonly Supermarket[] = [standard, aldi]

export const defaultSupermarketId = standard.id

/** The supermarket with this id, or the standard one for an unknown or missing id. */
export function getSupermarket(id: string | null | undefined): Supermarket {
  return supermarkets.find((s) => s.id === id) ?? standard
}
