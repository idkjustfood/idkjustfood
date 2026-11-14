import type { Supermarket } from "./supermarket.js"

/** The route most German supermarkets share. Chains without a route of their own use it. */
export const standardRoute: Supermarket["route"] = [
  "produce",
  "bakery",
  "dryGoods",
  "canned",
  "spices",
  "sweets",
  "meat",
  "fish",
  "dairy",
  "frozen",
  "drinks",
  "household",
]

/**
 * The typical German supermarket (Rewe, Edeka, Kaufland, ...): fresh produce and bread at the
 * entrance, the long aisles of dry goods and sweets, then the chilled and frozen counters, and
 * drinks at the end where the heavy things are easy to carry to the checkout.
 */
export const standard: Supermarket = {
  id: "standard",
  source:
    "General knowledge of how most German supermarkets are laid out. Not checked shop by shop.",
  route: standardRoute,
}
