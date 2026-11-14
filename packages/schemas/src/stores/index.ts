import { aldiNord, aldiSued } from "./aldi.js"
import { standardChains } from "./chains.js"
import { lidl } from "./lidl.js"
import { standard } from "./standard.js"
import type { Supermarket } from "./supermarket.js"

export * from "./sections.js"
export * from "./supermarket.js"

/**
 * Every supermarket the app offers: the standard one first, then the chains by name. To add
 * one, make a file next to `lidl.ts` and list it here. Nothing else changes.
 */
export const supermarkets: readonly Supermarket[] = [
  standard,
  ...[aldiNord, aldiSued, lidl, ...standardChains].sort((a, b) =>
    (a.name ?? a.id).localeCompare(b.name ?? b.id, "de")
  ),
]

export const defaultSupermarketId = standard.id

/** The supermarket with this id (or an older id of it), or the standard one for an unknown or missing id. */
export function getSupermarket(id: string | null | undefined): Supermarket {
  return (
    supermarkets.find((s) => s.id === id || s.aliases?.includes(id ?? "")) ??
    standard
  )
}
